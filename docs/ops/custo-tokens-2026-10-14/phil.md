# Phil: dados de custo (janela 5 dias, preço de lista, scripts em x/phil*.py, python3 -I)

Totais deste script: subagente US$ 1.465 · principal 411 (o claude-custo.py deu 1.508; dedupe um pouco diferente, ordem de grandeza igual). 1.132 agentes, 35.652 passos de subagente. ESTIMATIVA onde dito.

## 1. Custo por tipo de agente (5 dias)
| tipo | agentes | US$ | se fosse Sonnet | passos |
|---|---|---|---|---|
| general-purpose | 544 | 758 | 643 | 21.360 |
| workflow-subagent | 180 | 234 | 174 | 5.128 |
| revisor-eng-software-senior (nome aposentado) | 106 | 151 | 80 | 2.053 |
| revisor-eng-dados-senior (aposentado) | 106 | 135 | 72 | 1.803 |
| revisor-ux-senior (aposentado) | 88 | 80 | 80 | 3.124 |
| yannis-software | 36 | 46 | 26 | 848 |
| phil-dados | 35 | 42 | 25 | 754 |
| logan / naksu / gio / hanna | 36 | 20 | 16 | ~580 |
Modelo: Opus 1.107 · Sonnet 769 (inclui principal). Meta dos agentes (meta.json): general-purpose 474 sonnet / 62 opus; phil/yannis/revisores de Opus em ~60% dos casos, o resto sonnet ou sem override. Effort: 481 de 763 despachos em `high` (63%), 279 medium, contra a regra "high é raro".
Tudo-Sonnet daria 1.117 contra 1.465: teto de economia US$ 348/5d = US$ 70/dia. Dele, revisores Opus (software+dados+phil/yannis+hanna) = 172/5d (US$ 34/dia); general-purpose Opus (62 agentes rodando Opus apesar da regra) 115/5d (US$ 23/dia); workflow 60/5d (US$ 12/dia).
Output total de subagente: 3,5M tokens = US$ 52/5d (US$ 10/dia): effort/thinking NÃO é onde está o dinheiro.

## 2. Contexto por passo (subagente)
| faixa | passos | US$ |
|---|---|---|
| <=100K | 8.302 | 335 |
| 100-150K | 9.198 | 283 |
| 150-300K | 14.694 | 613 |
| >300K | 3.458 | 235 |
Faixas exclusivas somam 1.465. Passos >150K = 18.152 (51% dos passos, 58% do custo). Passos por agente: mediana 24, p90 63, máx 274. 191 agentes com >=50 passos custam US$ 530 (36% do custo, 17% dos agentes); 38 com >=100 passos = US$ 180; 7 com >=200 = US$ 54. Nenhum >=300.

## 3. Escritas de cache de subagente (208M tokens, US$ 727; TODAS são TTL 5 min, zero escrita de 1 h)
- 1º passo (prefixo + tarefa): 41,8M tok = US$ 141.
- Reescrita após espera >5 min: 12,7M tok.
- Crescimento normal da janela: 153,6M tok (~US$ 570). É a regra, não anomalia: cada passo grava o que entrou desde o anterior. O que entra: tool_result (principal fonte; ~92M tok estimados em todos os arquivos de subagente, chars/3,5), saída anterior do modelo (3,5M) e thinking (~17M tok estimados nos blocos).
- "outro" de US$ 80: não é compactação (0 de 70 casos têm queda de contexto). São 70 passos de subagente em que UM passo grava +70K tokens (média) sem espera: um tool_result enorme (ou vários paralelos), US$ 61 + ~US$ 19 no principal. Só ~30% desse salto aparece como tool_result medido (1,5M de 5,1M em 48 casos): o resto NÃO consegui atribuir (provável Read grande/vários Read paralelos, mas não verificado).
- Top tool_result por tokens (estimado): Bash 37,3M (33.639 chamadas, média 1,1K) · Read 22,0M (3.483, média 6,3K) · Read de imagem 3,8M (2.353 capturas, ~1,6K cada, estimado) · demais (WebSearch, WebFetch, MCP chrome, Agent, Edit) <0,3M cada. Ou seja: Bash e Read são 95% do que entra.

## 4. Prefixo fixo (1º passo de cada subagente)
Mediana 51,6K tokens (p10 49K, p90 54K); gio/yannis/phil ~54K; statusline-setup (tools: Read, Edit) 25,5K. Diferença de ~26K sugere que tools "*" pesa ~20K+ (esquemas + listas), mas é UMA amostra.
Composição medida nos logs de hoje (anexos de início, em bytes; ~4 bytes/token): skill_listing 30K (~7,5K tok; nos 5 dias a média foi 65K, a lista era maior) · instructions 29,8K (CLAUDE.md 14,8K + MEMORY.md 12,4K = ~7K tok) · deferred_tools 11,4K (~3K tok) · mcp_instructions 5,2K · agent_listing 3,9K · session_context 3,5K · system prompt ~5,3K. O resto (~20K tok) são esquemas das ferramentas.
Custo: 41,8M tok escritos no início = US$ 141/5d (US$ 28/dia) + releitura do prefixo em cada passo seguinte (35.652-1.132 passos × ~50K × ~US$ 0,16/M = ~US$ 280/5d, ESTIMATIVA). Prefixo total ~ US$ 420/5d = ~US$ 85/dia = ~29% do custo de subagente. Regra: 10K tokens a menos no prefixo = ~US$ 18/dia (conta: 226 inícios/dia × 10K × ~US$ 3,1/M escrita + 226 × 30,5 passos × 10K × US$ 0,16/M leitura = 7 + 11).

## Propostas ranqueadas (US$/dia)
1. **Revisores Opus: 1ª rodada Opus, rodadas seguintes Sonnet; `model: sonnet` obrigatório em general-purpose/workflow.** Teto 34+23+12 = US$ 69/dia; realista ~US$ 30-40/dia (metade das rodadas dos revisores, 62 general-purpose Opus eliminados). Risco: qualidade de achado em rodada de re-revisão; mitigação: Opus só no fim do lote (já é regra do dono). Esforço: baixo (frontmatter + CLAUDE.md + checar o despacho que esquece `model`; hoje 62 de 536 esquecem).
2. **Agente enxuto com `tools:` whitelist (Read, Grep, Glob, Bash, Edit, Write) no lugar de general-purpose** para execução Sonnet. Até ~25K tokens a menos no prefixo => até ~US$ 45/dia (dos 724 starts/5d de general-purpose+workflow, ~145/dia × 25K × 3,1/M + 145 × 36 passos × 25K × 0,14/M = 11 + 18 ≈ 29; ~US$ 30/dia). NÃO VERIFICADO: teste de 1 agente com a whitelist e ler o ctx do 1º passo antes de adotar. Risco: perde Skill/MCP (navegador fica com Gio/Claude). Esforço: baixo.
3. **Podar a lista de skills/plugins/conectores globais** (sales, legal, marketing, data, design, product-management, engineering; conectores claude.ai Notion/Gmail/Docs/Calendar/Drive; ficam frontend-design, superpowers, supabase, chrome-devtools): skill_listing ~7,5K → ~2K, deferred_tools+mcp ~4,3K → ~1K: ~9K tok => ~US$ 16/dia nos subagentes + ~US$ 3/dia no principal. Risco: baixo (ligar por projeto quando precisar). Esforço: baixo.
4. **Enxugar MEMORY.md** (14,3K bytes; histórico de sprints concluídos é carga morta em todo início): para ~5K bytes economiza ~2,3K tok => ~US$ 4/dia. Risco: nenhum (mover histórico para arquivo apontado). Esforço: baixo.
5. **Teto de agente: parar aos ~60 passos ou ~150K de contexto**, gravar estado em arquivo e abrir agente novo (ledger já existe). Os 191 agentes >=50 passos custam US$ 530/5d; passos >150K custam 58%. Se 30% desse bloco sair do regime >150K: ~US$ 10-15/dia. Risco: perda de contexto de tarefa longa; esforço: médio (disciplina de brief).
6. **Guardas de tool_result**: Bash sempre com `| tail -N`/saída em arquivo; Read com `limit` em arquivo >500 linhas; capturas só em Gio. Alvo: os 70 saltos de +70K (US$ 12/dia) e a cauda; ~US$ 4-6/dia. Risco: baixo; esforço: baixo (já parcialmente na CLAUDE.md).
7. **Effort `high` → medium como padrão** (481/763 despachos em high): output é só US$ 10/dia total, ganho <= US$ 2-3/dia. Fazer por disciplina da regra, sem prioridade.

Soma realista sem sobreposição: ~US$ 75-95/dia dos ~US$ 384/dia (20-25%). Propostas 2 e 3 sobrepõem parcialmente (ambas mexem no prefixo); o total de prefixo pelo caminho 2+3+4 não passa de ~US$ 40/dia.

## Do guia que NÃO se aplica / já está feito
- TTL de 1 h para subagente: zero escritas 1 h hoje; reescrita por espera >5 min é só ~US$ 3/dia; 1 h custaria 1,6x em toda escrita (US$ 727/5d): não compensa.
- Pausa com cache quente, timer, "não parar >4 min", relatório curto: já feitos.
- Haiku: sem uso; acima de 100K de contexto o preço sobe 5x e 51% dos passos passam disso: não aplicar.
- Compactação como causa dos US$ 80: descartada pelos dados (0 quedas de contexto).

## Não consegui verificar
- Tokens por conteúdo são chars/3,5 (imagem fixa 1,6K): ordem de grandeza, não medida exata. ~65% do crescimento de cache não fecha com tool_result+output medidos (92M tool_result estimados em todos os arquivos, não só na janela; gravação de crescimento 154M): thinking (~17M) e anexos explicam parte; o resto inexplicado.
- Decomposição exata do prefixo de ferramentas (~20K) e quanto a whitelist realmente remove (1 amostra).
- Se o modelo de despacho `high`/Opus nos 62 general-purpose foi escolha ou esquecimento.
