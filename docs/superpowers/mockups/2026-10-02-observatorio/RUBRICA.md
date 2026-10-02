# Rubrica de revisão — mockups do Observatório (nota 0–100)

Revisor: você NÃO criou este mockup. Seja severo e específico. Nota ≥ 98 só se um designer sênior
exigente e o dono (criador de YouTube que odeia número inventado) não encontrariam nada relevante.

| Eixo | Peso | O que conferir |
|---|---|---|
| Verdade dos dados | 25 | Todo número tem janela/amostra/frescor? Amostra pequena sinalizada? Vazio honesto e acionável? Fuso SP? Nada que a forja (12B, sem visão, sem causalidade) não poderia dizer? Algo implica dado que o sistema não terá (ver BRIEF "Fatos de dados")? |
| Utilidade para decidir o próximo vídeo/título/thumb | 20 | A tela responde às perguntas do BRIEF? Cada ação faz algo real e útil? Há ação inútil ou duplicada? |
| Hierarquia e arquitetura da informação | 15 | Um herói claro, ação primária única por contexto, densidade adequada a analista, escaneabilidade, agrupamentos que codificam informação. |
| Fidelidade ao sistema visual do CMS | 10 | Tokens do BRIEF, Fraunces/Inter/JetBrains Mono nos papéis certos, coerência com as outras telas, sem tiques de IA (eyebrows caps em tudo, "A · B · C" em todo meta, → em botões, gradiente decorativo, cards clonados). |
| Texto (PT-BR) | 10 | Acentos, sentence case, verbos claros, nomes consistentes ("Pedir leitura à forja" igual em todo lugar), sem jargão interno, sem "em desenvolvimento". |
| Acessibilidade | 10 | Contraste AA real (calcule os pares críticos: dim/muted sobre surface), foco visível, cor não é único canal, alvos ≥ 32px, reduced-motion, semântica (button vs div, aria em toggles/tabs). |
| Qualidade técnica e responsividade | 10 | Sem overflow/truncamento quebrado em 1440 e 768, tema claro e escuro funcionando, estados alternáveis funcionam, sem bugs de JS no console, CSS sem conflitos. |

## Procedimento
1. Leia o BRIEF.md e esta rubrica. Leia o HTML inteiro.
2. Se disponíveis, carregue chrome-devtools via ToolSearch ("select:mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page,mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page,mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_screenshot,mcp__plugin_chrome-devtools-mcp_chrome-devtools__resize_page,mcp__plugin_chrome-devtools-mcp_chrome-devtools__evaluate_script,mcp__plugin_chrome-devtools-mcp_chrome-devtools__list_console_messages,mcp__plugin_chrome-devtools-mcp_chrome-devtools__close_page,mcp__plugin_chrome-devtools-mcp_chrome-devtools__click"), abra o arquivo via file:// numa página NOVA, screenshot em 1440 escuro, 1440 claro (`document.documentElement.dataset.theme='light'`), 768; clique nos estados/toggles; leia o console. Feche a página ao final.
3. NÃO edite o arquivo.

## Saída (exatamente este formato)
NOTA: <n>/100  (por eixo: dados x/25, utilidade x/20, hierarquia x/15, sistema x/10, texto x/10, a11y x/10, técnica x/10)
BLOQUEADORES (impedem ≥ 90): lista numerada, cada um com local (seletor/trecho de texto) e correção exata.
IMPORTANTES (impedem ≥ 98): idem.
MENORES: idem.
O QUE ESTÁ EXCELENTE (não mexer): 3–5 itens.
