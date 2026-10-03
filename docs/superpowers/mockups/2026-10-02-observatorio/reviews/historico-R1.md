NOTA R1: 72/100 (dados 15/25, utilidade 16/20, hierarquia 12/15, sistema 8/10, texto 8/10, a11y 6/10, técnica 7/10)

BLOQUEADORES
1. Efeito mostrado antes de 7 dias (pairs t12, t23, thAC "parcial"; renderCompare) contradiz o próprio estado `few` e o BRIEF. Trocas < 7 d → chip "aguardando", bloco "Aguardando 7 dias — 3 de 7 coletados, leitura em DD/MM" sem média/delta/veredito. Dê ao `full` ao menos uma troca com ≥ 7 dias para demonstrar a régua. ATENÇÃO: re-date tudo para "hoje" 24/10 conforme CONVENCOES (snapshots desde 03/10).
2. Texto da forja fixo vaza entre estados (none+done fala do Opus; few+working cita contagens erradas). Gerar textos a partir do objeto de dados do estado; `none` com leitura própria ou forja=done desabilitado.
3. Horário de troca com precisão de minuto para título/descrição → ver CONVENCOES "Precisão temporal" (janela de 6 h; só thumbnail tem minuto).
4. Views/dia inconsistente para períodos < 24 h (A com 20 h mostra média; B com 11 h não) → regra única da CONVENCOES.

IMPORTANTES
1. Estado failed: botão laranja do header + "Pedir de novo" no card duplicados → header rebaixado; card "Pedir leitura à forja de novo".
2. notarch incoerente (arquivo começou 29/09 09:00 mas A ficou até 10:05) → coerente com "arquivamento desde 03/10".
3. Forja "4 dos últimos 30 vídeos" sem janela → "4 de 31 vídeos longos (últimos 90 dias) — n pequeno para chamar de padrão" (ajuste ao período real disponível).
4. "descrição raramente move views" sem fonte → "Não medimos efeito de descrição".
5. Chips duplicados (Thumb A→C junto com T3 repete números) → um chip "Título 2 → 3 + Thumbnail A → C (mesma janela)".
6. Hierarquia: card da forja entre header e herói empurra a curva abaixo da dobra → mover para depois da comparação ou recolher a 1 linha; comparação ganha par grande antes → depois (thumb + título da troca selecionada).
7. Contraste: --faint em texto informativo (fold do diff, .rail h6, ±) → mínimo --dim; accent claro dos tokens AA.
8. Alvos/semântica: .mk 26px → 32; .clip div → button/role=button; [data-ver] responde a foco.
9. Thumb B ilegível em 768 (clip 45px coberto por marcadores) → abaixo de ~70px só a letra; marcadores no topo da faixa.
10. vline atravessa o vazio no estado few → limitar às faixas / ocultar.
11. Fuso só no gráfico → "Horários em São Paulo" uma vez no topo.

MENORES
1. Thumb/Thumbnail/Descr. inconsistentes → CONVENCOES vocabulário.
2. Jargão (sync, ETag, diff, Snapshot enviado) → CONVENCOES vocabulário.
3. "views/dia médio" → "média de views/dia".
4. Diff de títulos picotado por token → trechos contíguos, ignorar pontuação.
5. Paginador sem filtro e sem sentido em none → dizer filtro; esconder em none.
6. Separadores "·" demais fora do selo → espaçamento/colunas.
7. Tokens → CONVENCOES.
8. Código morto em renderChart.
9. #themeBtn sem aria-pressed.
10. "Cancelar pedido" também em late e nomachine.

EXCELENTE (não mexer): curva em degraus "degrau = 1 dia" com dia em coleta hachurado e linha de esperado com n; três faixas alinhadas com destaque cruzado (A acende nos dois períodos); régua observado vs esperado vs IQR com veredito que recusa causalidade; vazios honestos; diff de descrição com toggle de UTM e "compatível, não confirmado".
