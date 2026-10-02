NOTA R1: 75/100 (dados 19/25, utilidade 16/20, hierarquia 11/15, sistema 8/10, texto 8/10, a11y 6/10, técnica 7/10)

BLOQUEADORES
1. Botão de histórico estoura o card de Short: `.grid.shorts .card .meta{white-space:nowrap}` — +18 a +28px em 1440, +4 a +14px em 768. Correção: flex-wrap no meta dos Shorts, ações em 2ª linha, ou minmax(212px,1fr) e sem nowrap.
2. Ajuste por idade fraco e vendido como resolvido. Tooltip diz "÷ mediana de views dos vídeos do canal publicados há 0–30 dias" e #basisText afirma "assim um vídeo de 300 dias não vence um de 20". Aplicar o método da CONVENCOES ("mesmo dia de vida" vs "aproximação por faixa"), tooltip diz qual método e "sem contar este vídeo".
3. Views/dia e Perenes/Antigos para > 90 d: ver CONVENCOES "Cobertura de dados" (série existe para todo vídeo acompanhado desde 03/10) — declare a fonte ("ritmo medido 17/10–24/10").

IMPORTANTES
1. Canal desatualizado: o multiplicador do vídeo não é marcado (só views/dia). Pôr ícone de alerta + "views de 23/09" no .vs, número tracejado.
2. Nome da ação: "Pedir à forja os padrões destes 11 outliers" → "Pedir leitura à forja" com escopo em subtexto/aria-label.
3. "Acompanhar no Health Coach" → "Acompanhar na fila da forja"; "posição 1" só se vier da fila real, senão "na fila".
4. Janelas misturam acumulado e exclusivo → faixas exclusivas conforme CONVENCOES.
5. Falta herói: cards clonados de mesmo peso; legenda da régua repetida em cada card. Abrir cada grupo com o nº 1 em destaque (thumb grande, título inteiro); legenda da régua uma vez por grupo.
6. Semântica de tabela quebrada na Lista: usar <table> ou roles completos.
7. `.info` 18×18 → área clicável 32×32.
8. Contraste claro falha AA (warning, .reuse, botão primário, "Perenes", "Estourando agora") → usar tokens claros da CONVENCOES.
9. Tokens divergentes do BRIEF → usar os da CONVENCOES (inclui ajustes AA aprovados).

MENORES
1. Vazio afirma demais → "nenhum dos 7 canais de IA que você monitora teve um Short acima de 2× nesta janela".
2. Contagem da aba Outliers muda com filtros enquanto as outras são fixas → fixar total da janela padrão.
3. Ordenação só dentro do grupo confunde → com sort ≠ multiplicador desligar agrupamento ou dizer "ordenado dentro de cada grupo".
4. `.ytbar` em 768 esconde itens sem indicação → fade na borda.
5. Painel demo fixo cobre dados → topo, recolhível (CONVENCOES).
6. Demo "Janela sem outliers" não restaura estado → guardar/restaurar.
7. Erro de console "Unsafe attempt to load URL file://" → confirmar que não é <use href>.
8. Nome do canal truncado nos Shorts → title= ou nome curto.
9. Denominador por nicho inventado (0.45/0.55) → derive da contagem real dos dados do mockup.

EXCELENTE (não mexer): frase #basisText com numerador/denominador/janela; tratamento de base fraca; vazio acionável com contagens; aviso da forja com limites do modelo; seletor de janela com contagens e aria.
