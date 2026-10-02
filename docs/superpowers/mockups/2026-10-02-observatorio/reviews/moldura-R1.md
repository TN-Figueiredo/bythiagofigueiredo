NOTA R1: 70/100 (dados 14/25, utilidade 15/20, hierarquia 11/15, sistema 7/10, texto 8/10, a11y 6/10, técnica 9/10)

BLOQUEADORES
1. Heartbeat de polling inexistente apresentado como fato (.forja-seg "olhou a fila às 15:00", .machine, relógio seen/missed, legenda "O site registra cada consulta"; regra própria "1 h sem olhada = sem máquina"; "sem máquina" para pedido de 0 min). → Seguir CONVENCOES "Fila da forja": o mockup mostra o alvo COM heartbeat, mas lista as dependências novas no painel "Dependências novas" da barra de estados; limiares da CONVENCOES; "sem máquina" nunca para pedido recém-criado se a máquina estava viva.
2. Tipos de pedido, recusa e cota diária = backend novo → painel "Dependências novas"; adicionar estado "liberado pelo watchdog (travou > 30 min) — volta para a fila".
3. Leitura "IA, últimos 90 dias" cita exemplo de 154 dias → exemplo dentro da janela; números coerentes.
4. Linha de Descrição na aba Mudanças com "6 linhas adicionadas" riscado como título antigo → CONVENCOES "Linha de descrição em listas".

IMPORTANTES
1. Hierarquia de ações: laranja em "Adicionar canal" no cabeçalho + segundo sólido teal no drawer → CONVENCOES "Hierarquia de ações".
2. Tokens → CONVENCOES (forja #5CC3B2 agora é token oficial do conjunto).
3. Contraste claro (on-accent 4,16; aba ativa 3,82) e danger escuro 4,40 → tokens AA da CONVENCOES.
4. Semântica: tabs sem aria-controls/setas; role=menu sem foco/setas; drawer overlay ≤1279 sem role=dialog/aria-modal/foco/trap; <button> dentro de <label class="opt"> → corrigir todos.
5. Tempo estimado contraditório (confirmar "<1 min", fila "não medido", trabalhando cita outro tipo) → CONVENCOES "Tempo".
6. Recusa tardia evitável no modo stale; histórico com "Temas — Viagem 29/09 publicada" impossível → aviso/desabilitar no seletor; datas coerentes.
7. "Pedir de novo depois do sync" enfileira na hora → "Sincronizar e pedir de novo" (enfileira ao terminar o sync).
8. "Abrir no Cowork com este pedido" = mesma ação que Copiar → "Copiar pedido para o Cowork" com instrução ⌘V.
9. Vazamento de estado (published=true persiste; contagem conta falha) → resetar; não contar falhas.
10. Efeito na linha de Mudanças sem janela → modelo de efeito da CONVENCOES (observado vs esperado, 7+7).
11. Popover de frescor: 403 de cota em um canal só é implausível (cota é por projeto) → causa por canal (ex.: 404 "canal não encontrado — mudou de handle?"); problemas primeiro.

MENORES
1. "llama" e horários com segundos → "o modelo local não respondeu".
2. Relógio sem-máquina: rótulo do gap sobrepõe ticks; falta marcador "agora".
3. Falhou: listar tentativas 1, 2, 3.
4. "Último pedido: 24/09 (Viagem)" ignora o de 27/09 (IA, falhou).
5. Nicho do pedido herda o filtro global; mesma ordem Todos · Viagem · IA.
6. Drawer + aba Insights duplicam "Leituras anteriores"; "Abrir leitura" → "Ir até a leitura".
7. Barra .mock cobre rodapé do drawer → barra no topo, recolhível (CONVENCOES).
8. .shell-tabs cortam em 768 sem fade.
9. Fuso "(SP)" no segmento de frescor do cabeçalho.
10. "vale para todas as abas" em 11,5px dim → ícone de pin com tooltip.
Datas: tudo relativo ao "hoje" 24/10/2026 15:02 da CONVENCOES (sync 09:00 de hoje etc.).

EXCELENTE (não mexer): card de andamento espelhando o Health Coach real (etapas, "pode fechar este painel"); botão do cabeçalho que vira status (contrato de progressButtonLabel); leitura publicada com selo, base comparativa, n, não classificados e "O que esta leitura não faz"; tela de confirmação Lê/Entrega/Não faz/Quando/Limite; barra de frescor com drill-down acionável.
