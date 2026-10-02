NOTA F1: 84/100 — auditMockup 0 falhas; números 100% OBS; contraste AA; teclado ok.
TELA
B1. Cota trava nicho/formato não usados (quotaHit) → comparar tipo + nicho (+ formato); com Todos só o nicho usado bloqueia.
I1. Amostra de Mudanças "aguardando… leitura em 25/10" sem willBeInconclusive → acrescentar o aviso.
I6. Relógio sem máquina com posições fixas e "próxima 15:08" para máquina morta → linear() sobre timestamps; sem heartbeat vivo: "sem previsão — volta quando a máquina consultar".
I7. Pedido enviado mostra 14:58 → requestScenario com createdAt = OBS.NOW (motor aceita createdAt).
I8. Todos: dois pedidos "pegos às 15:05" → IA às 15:05; Viagem "aguarda o pedido de IA".
I9. Rótulo do botão igual para estados equivalentes.
M1 15:05 repetido 5×; "desde 12:58" 4× → enxugar. M2 split('. ') → remover. M3 nicho marcado nas opções. M4 passo pendente "próximo"/"aguardando" (não "agora"). M5 superlativo 0 de 9 → lista "sem diferença"/sem atribuição com k = 0. M6 histórico capitalizado/pontuado; sem dois travessões. M7 hora da cota de quota.releasesAt (motor) igual nos dois estados. M8 Runbook = link ou remover. M9 tag "Short" na amostra. M10 um caminho só por aba. M11 href sem "?" sobrando. M12 "agora" colide com ETA. M13 Insights com Todos mostra as duas leituras (ou linha da Viagem).
MOTOR (dados.js)
I2. preview('resumo-trocas', niche) conta só trocas de channelsIn.
I3. Tempo por tipo/nicho: forja.timing(type, niche) / readingTypes[].timingText (temas e resumo-trocas têm 1 leitura).
I4. REQ_SCENARIOS.atrasado: busyWith começa ≥ 14:33 (< 30 min rodando).
I5. recusado: motivo imprevisível coerente com staleSyncHours 24 h e cabeçalho; sem "a forja" duplicado.
I7. requestScenario aceita {createdAt}.
I9. "nova tentativa" = falha do validador na tentativa 1 (motivo/horário), distinto de "liberado pelo vigia".
M7. quota.releasesAt.
