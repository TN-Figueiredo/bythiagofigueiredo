# F5 — correções por dono (consolidado das 7 revisões)

## MOTOR (dados.js)
M-a. Idade fracionária vs arredondada: readingScope.nThen, outliers({reading}) e forja.since usam a MESMA idade (e o mesmo maxAge) — "Nada mudou" não pode conviver com 92→93; "Desde então" fecha com o escopo de hoje (IA 366 vs 367; Viagem 184 vs 188; readingScope "via 172"). Item próprio para vídeos antigos encontrados pela busca/backfill.
M-b. Split Todos: 2º pedido com > 25 min vira "atrasado (atrás do de IA)"; falhou/recusado não no mesmo minuto para os dois nichos.
M-c. forjaFromScenario/statusLabel: não tratar como terminal enquanto algum pedido do split está ativo (publicado+Todos → "Pedido em andamento" + "Viagem: trabalhando desde 14:55").
M-d. effect.daily.before exclui o bin de < 24 h da estreia ("antes: 2 dias"); esperado com o mesmo recorte.
M-e. expectedCurve de vídeo anterior a 03/10 com o mesmo método/rótulo de effect.method (aproximação por faixa) — ou rótulo distinto com n.
M-f. sent.text consistente ("N canais com Shorts" sempre).
M-g. Sem textos "ok" crus: sync.label em todos os textos.

## CHROME (chrome.js/css)
C-a. initPrefs valida ?theme (light|dark) e ?niche (todos|viagem|ia) antes de vencer o localStorage.
C-b. Sincronizar concorrentes: sem sucesso fabricado → "Sincronização na fila"; 2º toast warn "11 canais sincronizados; 3 com problema (…)".
C-c. Abas: contagem/title usam o MESMO nicho do href (persistido) — N da aba = N do destino.
C-d. Frescor por nicho ativo ("2 com problema em Viagem · 3 no total") ou link com niche=todos.
C-e. Blindagem: svg color:inherit; fill/stroke dos ícones via CSS escopado; raízes com visibility/direction/word-break/overflow-wrap/cursor/font-variant/font-smoothing fixos; bateria com *{color:red} e svg *{stroke:red}; CHROME.md honesto.
C-f. Foco do "Sincronizar" dentro do popover (focusKey).
C-g. Toast padrão neutro (ícone info, borda neutra); bigorna só em toasts da forja. Falha ao copiar: focus()+select() no textarea.
C-h. Popover de frescor imprime sync.label (não "ok"). Toasts acima do rodapé de drawer modal.
C-i. Resize com rAF; setTheme valida; nome acessível do frescor com separadores.

## MOLDURA
Mo-a. resize não re-renderiza #content (só drawer()/fitDrawer) ou preserva <details>/foco.
Mo-b. Card de execução sem redundância (split e cota repetidos). Separador único em reqLabel. Cota com Todos: prefixo "Viagem:" nas linhas. "atrasado: as 5 últimas…" minúscula. 1280 com drawer: nowrap em "Ver comparação"/th, ou ocultar coluna Views no compacto. lastOpener ao fechar. aria-describedby no Continuar desabilitado. coworkText sem duplicar o do chrome. Idade via OBS.date.ago. "Tempo deste tipo" por nicho (não somar).

## CANAIS
Ca-a. back= com o filtro completo: gravar fmt/scale/view/sort/dir/q na URL (replaceState) e lê-los no load.
Ca-b. onSync conclui (2–3 s) com toast honesto (C-b), ignora clique durante.
Ca-c. "Sincronização concluída" coerente (chip/filtro por syncState; frescor do chrome no cenário) ou manter Paddy atrasado.
Ca-d. Drawer do canal: usar CHROME.drawer (coluna ≥ 1280) — ou registrar exceção; "Ver comparação" → Mudanças video+type=desc (ou rótulo "Ver histórico do vídeo").
Ca-e. Menores: "Nenhum Short acompanhado"; aba Outliers sem parcela 0; clique em "problemas" preserva niche; Copiar para o Cowork via mecanismo do chrome; modais com setInert; "até o registro diário de…" na tabela; veredito sem antes duplicado; audit own-empty só em fmt=long; nota da barra de estados com drawer; ordem Viagem, IA no toast; vão do card do Paddy; termo único "sincronizado" (motor) em vez de "Em dia".

## MUDANÇAS
Mu-a. back= com TODOS os filtros (win, fmt, sort, q, measured, saved + niche/type/channel/video/changes), nicho exibido (ou omitir com objeto); URL acompanha os filtros (replaceState em renderAll) e o parser lê win/fmt/sort/q/measured/saved.
Mu-b. Passar `ids=` para o Histórico (ordem visível) como o Outliers.
Mu-c. publicado+Todos: estado por nicho na linha e no cabeçalho (motor M-c).
Mu-d. Modo lista ?changes= ajusta nicho de exibição (persist:false) e explica a janela 90 d.
Mu-e. Com busy, trocar "Peça nova leitura…" por "O pedido em andamento vai atualizar esta leitura."
Mu-f. Menores: sumLine sem "pedido" repetido; NBSP em "há N h"; resumo aberto sem faixa vazia; .lnk sem inline-flex no meio do texto; legenda oculta no vazio; pedido novo em Todos diz que Viagem fica atrás.

## OUTLIERS
O-a. emptyState: ramo de canal fora do nicho no topo.
O-b. syncSegs sincroniza o <select id=sort>.
O-c. Ações da Lista ≥ 32 px (col 128 px).
O-d. reading= não vaza nicho para URL/localStorage (omitir niche com S.reading ou nicho exibido ≠ persistido).
O-e. Esq como "erro de sincronização" (sync.label/msg), não "atrasada"; grupo "Sem ritmo medido" usa phase.why do motor.
O-f. Menores: chips com maiúscula inicial; asof ambíguo mantido na URL + ✕ no chip de escolha; esconder faixa cortada < 7 dias; nome da fórmula no basisSum de min=0; back= com from=; aria-live só no #basisSum; mock reseta fmt/niche; tooltip "views de 24/10 12:00 (dia 5)"; quotaScope.text do motor; sem fallback 182; vão do lead a 768.

## INSIGHTS
I-a. BLOQUEADOR: sentReq por nicho ({viagem,ia}); Todos monta o split a partir dos dois; nunca permitir pedido duplicado ao trocar Todos ↔ nicho.
I-b. Cadência: hachurar desde sync.last com "sem sincronização desde…"; title em "Último upload".
I-c. Linha da cadência: rótulo "Ver outliers do canal" (ou min=0) e não clicável quando "não publica"; usar <a>.
I-d. Botão "Pedir nova leitura à forja" (formato no title).
I-e. Menores: sem status "publicado" no card sem pedido hoje; "0% vs 3,1%"; legenda do heatmap completa e alinhada, limiar 1,3 nomeado; prosa da leitura ("Nos longos dos últimos 6 meses, títulos com preço…"; "n = 92 vs 148"); "2 dos 3 em X — pouco para falar em tema"; CSS/código morto; comentários entre #screen e seletor removidos.

## HISTÓRICO
H-a. BLOQUEADOR: "Mesma descrição desde a publicação" só se publicação > início da observação do canal e canal ok; senão "Sem troca de descrição vista desde DD/MM" (+ "não conferida desde…" se atrasado).
H-b. Paginador segue o filtro de origem: ids= quando vier (Mudanças passará); senão OBS.changesIn(params do back, incl. changes=), texto cita o filtro.
H-c. n diferente no mesmo rótulo → "na mesma idade (31–90 dias em 07/10; n = 11)".
H-d. Vídeo fora dos acompanhados: vazio próprio (sem série, sem versões, sem "próximo é…").
H-e. Multiplicador de canal atrasado/erro com data ("3,2× até 22/10 12:00 (canal atrasado)") ou "sem ritmo medido".
H-f. Status sem triplicar (tirar #askStatus quando o chrome mostra).
H-g. Menores: "?." e travessões encadeados no vazio do Esq; "canal com erro de sincronização"/"ainda buscando vídeos"/"canal adicionado há 42 min"; legenda "esperado: sem base (n < 3)"; durações padronizadas; "Leitura anterior" sem data duplicada; "Na fila desde"/"Pedido das" sem repetir; "vs Shorts do canal"; "—" na 1ª linha da tabela; crumb "Canais" com back sem channel; padrões do nicho todos "sem diferença" → 1 linha; ressalva de Testar e comparar no card de comparação.
