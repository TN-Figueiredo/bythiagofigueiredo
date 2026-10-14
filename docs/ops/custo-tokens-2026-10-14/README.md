# Revisão de custo do Claude Code (14/10/2026)

Base: 5 dias, ~US$ 384/dia a preço de lista (`custo-5d.txt`); 79% subagente; prefixo fixo de ~51,6K tokens
por início de agente. Referência: deck da WWT "How Claude Code Costs Work". Análise: Phil (`phil.md`, scripts
em `scripts/`), Yannis (`yannis.md`); priorização: Hanna (`hanna.md`). O dono aprovou todas as recomendações
da Hanna, inclusive Sonnet nas re-revisões (P2).

## Aplicado em 14/10
| Item | Onde |
|---|---|
| Conectores claude.ai desligados no repo (`disableClaudeAiConnectors`) | `.claude/settings.json` (local, ignorado pelo git) |
| Hook que recusa `Agent` sem `model` e `effort` (fork fica de fora) | `.claude/hooks/agente-modelo-effort.py` + PreToolUse `Agent` |
| Regra: Sonnet executa, inclusive conserto de spec da 2ª rodada e re-revisão de emenda; Opus só no 1º rascunho, na 1ª revisão e no portão final; effort `medium` | `CLAUDE.md` (Economia de tokens) + memória |
| MEMORY.md: 6 entradas `project_*` fechadas foram para `memory/ARQUIVO.md` | memória do projeto |
| Agente `executor` (Sonnet, tools Read/Grep/Glob/Bash/Edit/Write) no lugar do general-purpose em execução | `~/.claude/agents/executor.md` |

Teste do `executor` (sessão `claude -p` descartável): 1º passo com **19,1K tokens**, contra ~53K de um
general-purpose (aceite era ≤35K). Falta confirmar numa tarefa real que nenhuma ferramenta faz falta.

## Pendente
- **Autocompact em 300K:** teste numa sessão só, com `CLAUDE_CODE_AUTO_COMPACT_WINDOW=300000 claude`. Passa se
  compactar perto de 300K e a sessão seguir sem reler plano nem perguntar o que já tinha sido decidido. Só depois
  disso vai para o global (`autoCompactWindow` em `~/.claude/settings.json`).
- **Plugins da conta (ação do dono no claude.ai):** desligar legal, sales, product-management, design, data,
  marketing, engineering e cowork-plugin-management (~8,5K tokens de lista de skills, 0 usos em 30 dias).
- **Rejeitado:** TTL de 1 h para subagente, Haiku, `omitClaudeMd`, Sonnet na sessão principal e `skillOverrides` local.
- **Backlog com gatilho:** ver a seção 3 de `hanna.md`.

## Aceite em 19/10 (`python3 ~/.claude/hooks/claude-custo.py 5`, comparado com `custo-5d.txt`)
- US$ por passo de subagente: de 0,041 para ≤0,034. O total só vale se o volume de passos ficar parecido (±15%).
- general-purpose/workflow em Opus ≤5% dos despachos; Opus ≤50% do custo de subagente; `high` ≤20% dos despachos.
- Mediana do 1º passo de subagente ≤47K (`scripts/phil*.py`).
- Qualidade: um caso de achado perdido por conserto ou re-revisão em Sonnet, ou de estado perdido por compactação,
  reverte o item.
