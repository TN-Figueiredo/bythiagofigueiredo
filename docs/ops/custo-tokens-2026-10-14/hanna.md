# Hanna (PO): o que fazer com as propostas de custo de Phil e Yannis

## Recomendação em três linhas
1. **Aplicar hoje, sem risco de qualidade:** conectores claude.ai desligados no repo, `model`/effort cobrados em todo despacho (é regra que já existe, hoje 62 de 536 despachos escapam), conserto de spec rodada 2 em diante em Sonnet e MEMORY.md enxuto. Ganho: ~US$ 20-35/dia.
2. **Testar primeiro, cada um num caso só:** agente enxuto com whitelist de `tools` (em uma tarefa Sonnet de execução) e `autoCompactWindow: 300000` (em uma sessão principal, por variável de ambiente). Juntos valem ~US$ 30-55/dia; vão para o global só se o teste passar.
3. **Fica para o dono:** Sonnet nas re-revisões de Phil/Yannis (mexe na regra dele) e a poda de plugins na conta claude.ai (só ele consegue fazer). **Rejeitado:** TTL de 1 h, Haiku, `omitClaudeMd`, Sonnet na sessão principal e teto rígido de passos. O dono vê o efeito na próxima leitura de 5 dias do `claude-custo.py` (dia 19/10).

Fonte dos números: phil.md e yannis.md (5 dias, preço de lista, base de ~US$ 384/dia). Não recalculei nenhum.

## 1. O que as duas análises acertam (preservar)
- As duas olham para o mesmo lugar: o **custo estrutural por passo** (prefixo de ~52K tokens relido em cada passo + contexto acima de 150K). O output é só ~US$ 10/dia, então effort e thinking não são a alavanca. Isso direciona tudo o que vem abaixo.
- As duas rejeitam o TTL de 1 h com conta (+US$ 87/dia contra um ganho de US$ 3/dia). Fica rejeitado.
- Yannis **testou** antes de recomendar (conectores: -4,2K tokens medidos) e **disse o que não funcionou** (`enabledPlugins`/`skillOverrides` para plugins sincronizados). É esse o padrão que eu cobro para os itens "testar primeiro".

## 2. Achados

| # | Item | O que está errado ou falta | Evidência | Custo | Severidade |
|---|---|---|---|---|---|
| A | Somas dos dois | As somas (Phil ~75-95/dia, Yannis ~40-60/dia) se sobrepõem: whitelist, conectores e poda de skills tiram tokens do **mesmo** prefixo. | Phil: "2+3+4 não passa de ~US$ 40/dia" | Expectativa inflada para o dono | corrige: prometer ~US$ 55-80/dia no total, não a soma |
| B | (b) autocompact 300K | A chave é **global**: afeta a sessão principal (o orquestrador, 63% do custo dela acima de 300K) e os outros projetos. É a única proposta que pode perder estado do trabalho no meio. Simulação, sem disparo real em `opus[1m]`. | yannis 2.1, §5 | ~US$ 26/dia em jogo | corrige: testar numa sessão antes do global |
| C | (a) whitelist | Uma amostra só (statusline-setup, 25,5K). Pode cortar `Skill` (TDD do superpowers), MCP e `Agent`; não se sabe se o executor precisa de algum desses. | phil §4, "NÃO VERIFICADO" | ~US$ 30/dia em jogo | corrige: testar em 1 agente |
| D | (c) Sonnet nas re-revisões | Mexe na regra do dono ("Phil/Yannis revisam no fim; Opus revisa"). Não é corte meu. Já o **conserto** de spec por general-purpose em Opus (50 de 57, US$ 151/5d) é aplicar achado pronto, ou seja, execução: cabe na regra "Sonnet executa" que já existe. | yannis 1.3; MEMORY "Modelo e effort dos subagentes" | 10-20/dia (re-revisão), até 15/dia (conserto) | conserto: aplica já; re-revisão: dono |
| E | Despacho sem `model` / com `high` | Regra já escrita e reforçada pelo dono em 13/10, mas violada: 62 general-purpose em Opus, 63% dos despachos em `high`. Isso não é proposta nova, é dívida de disciplina. | phil §1 | ~US$ 23/dia + 2-3/dia | **bloqueia**: cobrar antes de qualquer teste, senão a medição dos testes fica contaminada |
| F | (d) teto de passos | Escopo médio (disciplina de brief), ganho de 10-15/dia que **sobrepõe** o autocompact (os dois atacam o contexto >150K). `maxTurns` só vale para agente nomeado, que nunca passa de 36 passos. | phil 5; yannis §4.3 | 10-15/dia, sobreposto | sugestão: backlog |
| G | Critério de medição | `claude-custo.py` mede o total, mas o volume de trabalho muda de semana para semana; US$/dia sozinho não prova nada. | base: 35.652 passos de subagente em 5d | | corrige: medir também US$ por passo |

## 3. Ordem de execução

### Já (hoje, pelo controlador; nenhuma muda o resultado entregue)
| # | Ação | Ganho (fonte) | Custo de qualidade | Quem confere |
|---|---|---|---|---|
| 1 | `"disableClaudeAiConnectors": true` no `.claude/settings.json` do repo | 3,5-7/dia (Yannis, medido) | Nenhum: 0 usos em 30 dias. Some o MCP "Claude Docs" neste repo; nenhum fluxo usa | controlador, `/context` antes/depois |
| 2 | Todo despacho com `model` explícito (general-purpose e workflow = sonnet; Opus só para o rascunho 1 de spec/plano) e effort `medium` por padrão | ~23/dia + 2-3 (Phil) | Nenhum novo: é a regra do dono | controlador; *sugestão, confirmar com software:* hook PreToolUse no `Agent` que recusa despacho sem `model` |
| 3 | Conserto de spec da rodada 2 em diante em Sonnet medium (o rascunho 1 continua em Opus; a revisão de Phil/Yannis segue como está) | até ~15/dia (Yannis) | Baixo: o conserto aplica achado já escrito, e o revisor Opus confere em seguida | Phil/Yannis na rodada seguinte |
| 4 | MEMORY.md: entradas `project_*` de entregas fechadas vão para `memory/ARQUIVO.md` com uma linha de ponteiro; **todos os `feedback_*` ficam** | 1,5-4/dia (os dois) | Nenhum: nada se apaga, só sai do índice carregado | controlador; o dono vê o diff |

### Testar primeiro (um caso cada, hoje ou amanhã)
| # | Teste | Passa se | Se passar | Se falhar |
|---|---|---|---|---|
| 5 | Agente `executor` (sonnet, `tools: Read, Grep, Glob, Bash, Edit, Write`; segunda variante com `Skill`) numa tarefa real de execução de plano | 1º passo com ≤35K tokens (hoje a mediana é 51,6K) **e** tarefa entregue sem pedir ferramenta que falta | vira o padrão de execução Sonnet no lugar do general-purpose | fica general-purpose; anotar qual ferramenta faltou |
| 6 | `CLAUDE_CODE_AUTO_COMPACT_WINDOW=300000` numa sessão principal (não no global) | compacta perto de 300K, e depois da compactação o controlador continua sem reler plano nem perguntar o que já tinha sido decidido | vai ao dono como pergunta P1 com o resultado | rejeitado; o handoff de 80% continua sendo a defesa |

### Para o dono decidir (ver perguntas)
- P1 autocompact global; P2 re-revisões em Sonnet; P3 poda de plugins na conta claude.ai.

### Rejeitar
| Item | Por quê |
|---|---|
| TTL 1 h (subagente e agentes nomeados) | +87/dia de custo contra 3/dia de ganho (os dois concordam) |
| Haiku para busca | O prefixo de 53K já passa do degrau de 100K em poucos passos; não há tarefa de leitura pura |
| `omitClaudeMd` nos nomeados | 1,2/dia contra o risco de perder "este sistema falha em VERDE" |
| Sonnet como modelo da sessão principal | Ela é o orquestrador e o juiz; sem A/B, e trocar no meio queima o cache |
| `skillOverrides` local para plugins sincronizados | Testado sem efeito confirmado; o caminho é o painel da conta (P3) |

### Backlog (com gatilho)
| Item | Gatilho para voltar |
|---|---|
| Teto de passos no brief ("handoff aos 120 passos") | se, depois do item 6, os agentes com ≥100 passos ainda custarem >US$ 20 em 5 dias |
| Plugin supabase desligado no repo (~1/dia) | se Phil disser que não usa a skill de Postgres na revisão de migration |
| `.git/info/exclude` para `**/shots/` (~0,3/dia) | quando o dono decidir o que fazer com as capturas do Gio |
| Pre-commit com saída em arquivo | nunca, a não ser que apareça na lista dos maiores tool_result |

## 4. Critérios de aceite (medir em 19/10 com `python3 ~/.claude/hooks/claude-custo.py 5`, comparando com custo-5d.txt)
A carga muda de semana para semana, então o critério principal é **por passo**, e não o total.

| Item | Métrica | Hoje | Aceite |
|---|---|---|---|
| Geral | US$ por passo de subagente (custo de subagente ÷ passos) | 0,041 (1.465 / 35.652) | ≤0,034 (-17%) |
| Geral | US$/dia total | ~384 | ≤330 se o volume de passos for parecido (±15%); senão vale só o por passo |
| 1, 4, 5 | Mediana do 1º passo de subagente (script `x/phil*.py`; não conferi se o `claude-custo.py` mostra isso) | 51,6K | ≤47K só com 1+4; ≤35K nos agentes `executor` |
| 2 | General-purpose/workflow em Opus | 62 de 536 general-purpose; US$ 122 de workflow em Opus | ≤5% dos despachos; Opus ≤50% do custo de subagente (hoje ~60%) |
| 2 | Despachos em `high` | 63% | ≤20% |
| 3 | Custo de general-purpose "consertar spec, rodada N≥2" em Opus | US$ 151 / 5d | ~0 |
| 6 (se aprovado) | Fatia >300K da sessão principal; reescritas "outro: compactação/retomada" | 63%; US$ 80 / 5d | ≤10%; ≤US$ 30 / 5d |
| Qualidade (todos) | Achado "bloqueia" de Phil/Yannis que um conserto Sonnet deixou passar e só a rodada seguinte pegou; retrabalho por estado perdido depois de compactar | sem base | 0 casos relatados pelo controlador ou pelo dono na janela; 1 caso = reverter o item |

## 5. Perguntas ao dono (cada uma com o padrão para o trabalho não parar)
- **P1. Ligar `autoCompactWindow: 300000` no global** (vale para todos os projetos; a sessão principal compacta perto de 300K em vez de crescer até ~900K)? Ganho ~US$ 26/dia; o custo é que o resumo pode descartar detalhe. **Padrão enquanto ele não responde:** só o teste numa sessão (item 6), nada no global.
- **P2. Re-revisões de Phil/Yannis ("conferir emenda", "fecho") em Sonnet**, com Opus na 1ª revisão e no portão final do lote? Ganho 10-20/dia; o risco é Sonnet deixar passar defeito de concorrência ou Big O na emenda. **Padrão:** continua tudo Opus (é a regra dele). Minha preferência: sim, desde que o portão final continue Opus.
- **P3. Desligar na conta claude.ai os plugins sem uso** (legal, sales, product-management, design, data, marketing, engineering, cowork-plugin-management), mantendo frontend-design, superpowers, chrome-devtools e supabase? Ganho ~6/dia, 0 usos em 30 dias, e é ação manual dele no painel. **Padrão:** nada muda até ele fazer. Minha preferência: sim; vale para todos os projetos dele e pode religar quando quiser.

## 6. O que eu NÃO conferi
- Não li o guia, os logs, o `claude-custo.py` nem os scripts; todos os números vêm de phil.md e yannis.md.
- Não sei se o `claude-custo.py` mostra a mediana do 1º passo e o modelo por tipo de agente. Se não mostrar, a medição de 19/10 usa os scripts do Phil ou ganha essas colunas (confirmar com dados).
- O hook que recusa despacho sem `model` é sugestão minha: viabilidade e forma, confirmar com software.
- Não verifiquei se algum fluxo do Gio depende do MCP Claude Docs ou dos conectores (Yannis mediu 0 usos em 30 dias; confio nisso).
