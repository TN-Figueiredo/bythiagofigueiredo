NOTA R3: 86/100 (dados 22/25, utilidade 18/20, hierarquia 13/15, sistema 8/10, texto 8/10, a11y 9/10, técnica 8/10)
Verificado por script e OK: números da forja = base congelada nos 4 escopos; todos os limiares nas bordas; dias da semana; "falhou" nunca coincide; ≤ 1 preenchido em 36 combinações.

BLOQUEADOR
1. Contagens das abas erradas (41/136, 17/58, 24/78) → CONVENCOES "Rodada 3 — complementos": Todos 14/18/11 · Viagem 8/8/5 · IA 6/10/6; markup inicial 18 e 11; title= em cada aba (textos como outliers.html).

IMPORTANTES
1. Abas levam a painel vazio → links para os arquivos irmãos, aria-current na atual.
2. Cota vs botão em falhou/recusado → "falha e recusa não contam na cota"; painel "usada hoje: 0".
3. Rodapé de Fórmulas sem fallback → "quando o canal tem menos de 3 vídeos com série desde o dia 0, cai para a aproximação por faixa".
4. "sem máquina" com pedido na fila mas botão habilitado → "Pedido em andamento" desabilitado + "Seu pedido das HH:MM está na fila e roda quando a máquina voltar"; sem pedido, tirar "queued" do painel.
5. Vazio contradiz TIME_NOTE → "Tempo deste tipo ainda não medido (nenhuma leitura ainda; a mediana aparece a partir de 5)".
6. "Você no nicho" com "sincronizado há 3 h" fixo sob stale=1 → derivar de state.stale.
7. Esq Unltd Daily sem sync e pedido habilitado sem dizer → "Esq Unltd Daily fica fora (sem sincronização há 3 dias)".

MENORES
1. "ler o jsonl" → "ver o log das execuções".
2. .allstate h2 em Fraunces → Inter 600.
3. Stale + pedido em andamento → "o pedido em andamento vai ler dados de 31 h".
4. Links de evidência → asof=2026-10-20 ou "hoje são 4".
5. "Desde então: +14" → "+14 novos, 14 saíram da janela de 90 dias".
6. Links de Fórmulas → min=0 ou "(todos, não só outliers)".
7. Heatmap: número em toda célula com n ≥ 3 (c1/l1 só por matiz).
8. "380× seus inscritos", v7, eng digitados → derivar ou marcar "dado da sincronização".
9. Topbar 768 sem indicador de rolagem → fade.
10. .idle sobre hachura ~4,2 → fundo --surface no rótulo.

EXCELENTE (não mexer): fonte única com RULES no gerador; leitura congelada com "Desde então…" e conta sem o canal dominante; fila fiel às convenções + Dependências novas; heatmap divergente com hachura n<3; contraste AA e alvos ≥ 32.
