# Brief (executor): medição semanal do custo do Claude Code

Contexto: em 14/10/2026, ~11:00 (horário de São Paulo), aplicamos as mudanças do `README.md` desta pasta. O dono quer
medir tudo e avaliar em 1 semana (21/10). Construa o medidor; não mexa em settings, agentes nem CLAUDE.md.

## Entregáveis
1. `~/.claude/hooks/custo-aceite.py` (python3, só stdlib; sempre rodar com `python3 -I`). Reaproveite as funções de preço
   e de época de `~/.claude/hooks/claude-custo.py` (copie-as; esse script não é módulo) e a lógica de `scripts/phil*.py`
   desta pasta (subagente por tipo, modelo e effort dos despachos, tamanho do 1º passo). Uso:
   - `custo-aceite.py janela --desde 2026-10-09T00:00 --ate 2026-10-14T11:00 [--json saida.json]`: imprime as métricas.
   - `custo-aceite.py diario`: mede as últimas 24 h e ACRESCENTA uma linha em `~/Workspace/handoff/custo/diario.csv`
     (cria com cabeçalho; não duplica o mesmo dia).
   - `custo-aceite.py relatorio --base base.json --desde 2026-10-14T11:00 --ate <agora>`: escreve
     `~/Workspace/handoff/custo/AAAA-MM-DD-avaliacao.md` com tabela base × depois × meta × passou/falhou.
   Métricas (todas por janela, preço de lista): US$ total e por dia; passos (principal, subagente); **US$ por passo de
   subagente**; % Opus no custo de subagente; despachos de Agent (total, % sem `model`, % general-purpose/workflow em
   Opus, % effort `high`, contagem por subagent_type, inclusive `executor`); **mediana do contexto do 1º passo** de
   subagente, geral e por tipo (executor × general-purpose); % do custo da sessão principal com contexto acima de 300K;
   reescritas de cache por causa (mesmas causas do claude-custo.py) e número de compactações; escrita × leitura × output.
   Metas (do README): US$/passo de subagente ≤0,034; general-purpose/workflow em Opus ≤5% dos despachos; Opus ≤50% do
   custo de subagente; `high` ≤20%; mediana do 1º passo ≤47K. Volume de passos fora de ±15% da base: o total por dia vira
   "não comparável", e vale só o por passo.
   Datas e horas da CLI em horário local (America/Sao_Paulo). Log bruto nunca vai para a saída; só agregados.
2. Linha de base congelada: rode `janela` de 2026-10-09T00:00 a 2026-10-14T11:00 e grave
   `~/Workspace/handoff/custo/base-2026-10-14.json`. Confira contra `custo-5d.txt` desta pasta (US$ 1.918 em 5 dias,
   79% subagente): a diferença tem de ser pequena e explicada.
3. `~/Library/LaunchAgents/com.thiago.custo-claude.plist` (StartCalendarInterval diário às 23:30, stdout/stderr em
   `~/Workspace/handoff/custo/launchd.log`) chamando um wrapper `~/.claude/hooks/custo-diario.sh` que roda `diario` e, a
   partir de 21/10, se o relatório ainda não existir, roda `relatorio` e mostra notificação do macOS
   (`osascript -e 'display notification ...'`) dizendo onde está o arquivo. NÃO rode `launchctl load` (o controlador
   faz); valide o plist com `plutil -lint`.
4. Rode `diario` uma vez e `relatorio` uma vez (com --ate agora) para provar que funcionam. Coloque as saídas em arquivo.

## Regras
- Nenhum comando parado mais de 4 min: em background com saída em arquivo.
- Relatório final em até 10 linhas: caminhos, números da base e qualquer métrica que não deu para medir (e por quê).
- Se faltar alguma ferramenta, diga qual: isso mede o próprio agente executor.
