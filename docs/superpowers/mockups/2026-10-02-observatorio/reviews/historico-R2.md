NOTA R2: 79/100 (dados 18/25, utilidade 17/20, hierarquia 13/15, sistema 7/10, texto 8/10, a11y 8/10, técnica 8/10)
Régua recalculada pelo revisor: TODOS os números batem (t12 neutro +1 pp; t23 inconclusivo; 290,2 mil; médias por período; horas→datas). Manter.

BLOQUEADORES
1. Ação da forja em laranja (#askForja.btn.primary no idle/done; "again" no failed) → .btn.forja-solid teal (CONVENCOES Rodada 3). No failed com leitura anterior: "Pedir nova leitura à forja".
2. Horários no futuro (queued 15:04, working 15:10 com "hoje" 15:02) → queued "Pedido 24/10 14:58", working "Começou 15:00".
3. diffSum conta UTM duas vezes (+5 −4 vs lista +4 −3) → "+4 −3 linhas, mais 1 mudança só de link/UTM (oculta)", calculado de S.diff; também no tooltip do marcador e em "Dados enviados à forja".
4. "Recusado" contradiz o cabeçalho (sync há 3 h) → motivo imprevisível ("os dados enviados ficaram 26 h na fila e venceram antes de serem lidos — peça de novo"); dado velho previsível = botão desabilitado com "sem sincronização desde DD/MM — sincronize antes".
5. Bug CSS: `.win` do lane vaza para `<i class="sw win">` da legenda (quadrado em 460,18 sobre a aba) → `.lane .win{}` ou `.sw.swwin`.

IMPORTANTES
1. D1→D2 dentro da janela "depois" de t12 sem aviso → cav em t12 e t23 citando a troca de descrição e a alternância A→B→A.
2. notarch: médias de versões com from < 03/10 sem fonte → "≈ 3,8 mil (só desde 03/10, 21 dias)".
3. Regra < 24 h quebrada no estado few (atalho S.few em renderVersions) → usar periodAvg.
4. Textos da fila fora da CONVENCOES → frases exatas da seção Rodada 3.
5. Painel "Dependências novas" na barra de estados (heartbeat, refused, cota, task_type leitura por vídeo).
6. Contraste claro: selo/state da forja 4,27; sidebar ativa 3,70; UTM 3,01 → tokens Rodada 3.
7. Alvos: clip da thumb B 23px (1440)/12px (768); .clip 30px de altura → área ≥ 32×32 e .clip{top:16px;bottom:4px}.

MENORES
1. "sem base" → "inconclusivo (menos de 1 dia no ar)" / "não medido".
2. Rótulos das barras "6" → "6,0"; "10,1" cortado pela faixa.
3. "21 registros diários" → 22 registros / 21 dias.
4. Legenda da linha esperado: "ancorada no 1º dia deste vídeo".
5. Toast do Cowork: "Pedido copiado — cole no Cowork com ⌘V".
6. .btn.pending focável sem efeito → link para #forja.
7. Sidebar "Competitors" → "Competidores".
8. h2 max-width 30ch deixa "Hard" sozinho → ~40ch / text-wrap:balance.
9. Menu ⋯ solto em 1440 → alinhar na linha de "Abrir no YouTube".
10. Estado few sem eixo de tempo nas faixas → ticks de data.

EXCELENTE (não mexer): fonte única effect()/periodAvg(); curva em degraus + dia em coleta + esperado com n + faixas de 6 h com destaque cruzado; par grande antes/depois + régua que recusa causa; vazios honestos; comparação de descrição com ruído oculto.
