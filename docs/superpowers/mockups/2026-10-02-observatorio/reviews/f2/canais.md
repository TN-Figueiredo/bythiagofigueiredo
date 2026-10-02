NOTA F2: 81/100 — 15 drawers, audit do autor ok, AA ok, sem chrome local.
TELA
B1. Drawer não atualiza após trocar nicho pelo select do drawer → re-render (openDrawer/forjaState) após setNiche; toast avisa se o canal saiu do filtro atual.
B2. own-empty: drawer do seu canal usa OBS.scenario('own-empty') (ritmo, views/dia, engajamento, Vídeos, nota de vazio) quando st.youEmpty.
B3. Outliers do drawer: contagem = longos + Shorts (ou "1 + 1"); link por formato ("Ver o Short em Outliers" fmt=short).
I1. Idade dos vídeos via D.ago (horas < 48 h) com title absoluto, também nas células de outlier.
I2. "— views" → motivo ("sem contagem: sincronização do canal atrasada desde 23/10 00:00").
I3. Drawer usa growth30.text/uncertainty (±10 mil), não roundingText.
I4. "3 canais com problema" vs "(4)" → "problema ou parados (4)" ou separar.
I5. Escopo do pedido no drawer cita channelsOut com motivo.
I6. Cabeçalho do drawer apertado em 1440: dstats 3+2 ou rodapés de 1 linha; status da forja no topo da aba Trocas ou rodapé ≤ 2 linhas; "Remover canal…" à esquerda na linha dos botões.
I7. NBSP em "n = N"; textos curtos nas células (Vou sem volta) com detalhe no title.
I8. Cota do resumo de IA não desabilita o botão global do cabeçalho (cota por tipo/nicho); CHROME.setTabNew('mudancas') no publicado.
M1 F.plural "1 canal". M2/M3/M4 textos (motor + tela): frases em vez de dois-pontos encadeados; "lê 10 trocas…; este canal entra." M5 ≈ 0 sem ícone duplicado. M6 thumbs (motor). M7 "fase: recentes" com title. M8 15 e 03/10 de OBS.RULES/SERIES_START. M9 #addLimErr. M10 sem padding extra a 768. M11 "Parado" no drawer do bald. M12 ação no vazio own-empty.
Obs.: nota "longos e Shorts" no cabeçalho da coluna Trocas.
MOTOR
textos de requestScenario sem dois-pontos encadeados ("…voltou para a fila (tentativa 2 de 3). O validador recusou a tentativa 1 às 14:22 porque…"); recusado sem jargão ("a máquina recebeu dados de 23/10 18:00, anteriores à sincronização das 12:00. Peça de novo."); preview text com minúscula após ":"; thumb.text = palavra-chave do título (substantivo/número), nunca "HOW MAKE"/"QUE NINGUÉM".
