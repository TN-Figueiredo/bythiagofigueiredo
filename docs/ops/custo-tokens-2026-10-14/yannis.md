# Yannis: configuração do harness e processo, confrontados com o guia

Escopo: leitura apenas. Nada em settings, agentes, CLAUDE.md ou código foi editado. Testes de efeito feitos com `claude -p --model haiku`
em pastas descartáveis (`t1`..`t6` nesta pasta, custo de centavos). Dados: 5 dias de log (US$ 1.918, igual ao brief).
Scripts de medição (agregam, não carregam log): `y_an.py`, `y_pref.py`, `y_ctx.py`, `y_sim.py`, `y_tool.py`, `y_bust.py`.

## 0. Resumo ranqueado

| # | Proposta | Ganho (US$/dia) | Risco | Esforço | Confiança |
|---|----------|-----------------|-------|---------|-----------|
| 1 | `autoCompactWindow: 300000` (global) | ~27 (sessão principal 19 + subagentes 8) | médio (compactação perde detalhe) | 1 linha | média: simulação |
| 2 | Desligar conectores claude.ai (Gmail, Notion, Docs, Calendar, Drive, Linear) no repo | 4 a 7 | baixo (0 usos em 30 dias, todos os projetos) | 1 linha | alta: medido |
| 3 | Enxugar a lista de skills dos plugins sincronizados da conta (legal, sales, PM, design, data, marketing, engineering) | ~6 | baixo (0 usos em 30 dias) | manual na conta claude.ai | média: mecanismo local NÃO confirmado |
| 4 | Sonnet nas rodadas mecânicas (conserto de spec pós-revisão, "conferir emenda") | 10 a 20 | médio (qualidade de spec/portão) | edição de brief/agente | baixa: decisão do dono |
| 5 | Arquivar entradas `project_*` antigas do MEMORY.md | 1,5 a 3 | baixo | 15 min | média |

Somando 1, 2, 3 e 5: ~40 a 45 US$/dia (10 a 12% do gasto), sem tocar em modelo de agente. Com 4: até ~60.
Nenhum item é a "grande alavanca" isolada: o gasto é plano (os 10 maiores subagentes somam 6% do custo de subagentes;
os 100 maiores, 32%). O que sobra é custo estrutural por passo (prefixo + contexto longo), e os itens acima atacam exatamente isso.

## 1. Cache TTL, modelo e agentes

### 1.1 `subagentPromptCacheTtl` / `experimental.cacheTtl: 1h`: NÃO ligar

Chaves existem na 2.1.299 (confirmado no binário: `subagentPromptCacheTtl` em settings, `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL`
no ambiente, `experimental: { cacheTtl }` no frontmatter do agente; a doc embutida diz que "1h" é ignorado em excedente de assinatura).
Conta, com os números reais do log:

- Escrita de cache dos subagentes: US$ 727 em 5 dias, 100% em 5 min (general-purpose 105M tokens, workflow-subagent 36M, yannis 5,5M; zero em 1h).
- Passar tudo a 1h custa 2x em vez de 1,25x na escrita: +60% sobre 727 = **+US$ 436 em 5 dias (+87/dia)**.
- Ganho possível: as 29 reescritas por "subagente esperou > 5 min" custam US$ 15 em 5 dias (3/dia). Todas em `general-purpose`.
- Os agentes nomeados que esperariam (reviewers, Gio): **0 reescritas por espera** em 5 dias. Não há agente que justifique `cacheTtl: 1h`.
- Por agente (`general-purpose` não aceita frontmatter): impossível de qualquer forma. A saída é a regra que já existe no CLAUDE.md
  (comando longo em background, devolver controle).

Veredito: rejeitado. O guia diz "só para agentes que esperam testes/CI"; neste repo CI/teste pesado roda no GitHub/Vercel, não dentro de subagente.

Sessão principal: `Unset = automatic: 1 hour on a Claude subscription`. Já está em 1h (14,7M tokens escritos em 1h, 0 em 5m). Nada a mudar.

### 1.2 Sessão principal em Opus 1M: manter o modelo, limitar a janela (ver 2.1)

Principal = US$ 82/dia, 100% Opus. 63% desse custo (US$ 259 de 411) está em passos com contexto acima de 300K; 81% acima de 200K.
Trocar o default para Sonnet cortaria no máximo ~metade (~41/dia), mas a sessão principal é o orquestrador/juiz e o CLAUDE.md
já fixa "Opus planeja e faz a revisão final". Não recomendo trocar sem A/B; e trocar no meio da sessão queima o cache. O custo que dá
para tirar sem mudar de modelo é o do contexto inchado, que é o item 2.1.

### 1.3 Agentes opus que poderiam ser sonnet (custo por classe, 5 dias)

- phil-dados + yannis-software + os `revisor-engenharia-*` (mesmas pessoas com nome antigo): ~US$ 400 (21% do gasto), todos Opus.
  Decisão do dono (Opus na revisão final). Reduzir só as rodadas mecânicas ("Conferir emenda", "Fecho", "Confirmação final"): são
  verificação contra lista de achados já escrita. Sonnet cobre. Estimativa 30% das rodadas x 50% de desconto = ~12/dia. Risco: Sonnet deixar
  passar defeito de concorrência/Big O na emenda. Mitigação: Opus só no primeiro passe e no portão final do lote.
- `general-purpose` com model opus: 62 agentes, US$ 235 (de 767 do general-purpose). Descrição dos 57 com custo: 50 são "consertar o spec,
  rodada N" / plano (US$ 151), 7 implementação (33), 5 revisão (17). O conserto de spec recebe "conserto acionável" pronto dos revisores: é
  tarefa de aplicar, não de desenhar. Sonnet medium faz. Ganho potencial até ~15/dia se todas as rodadas >=2 migrarem (o rascunho 1 fica Opus).
- `workflow-subagent`: US$ 239, dos quais US$ 122 em Opus (1.063 passos). Não há `.meta.json` com descrição para classificar; olhar o script
  do workflow e fixar `model:` por fase. Não consigo afirmar vazamento.
- gio/logan/naksu já são sonnet: correto. hanna-po opus custa US$ 4 em 5 dias: irrelevante.
- Haiku para busca/leitura: **não recomendo**. O prefixo de um subagente aqui é ~53K tokens; o degrau de 100K do Haiku (5x no pedido
  inteiro) chega em poucos passos. Sem evidência de que haja volume de "só buscar" (nenhum `Explore` nos logs; tudo é general-purpose
  com tarefa de revisão/implementação). Reabrir se aparecer tarefa de leitura pura.
- `omitClaudeMd: true` nos agentes nomeados (existe no frontmatter): tira ~29K chars (CLAUDE.md + MEMORY.md) do contexto deles. Ganho
  ~1,2 US$/dia (só 107 execuções nomeadas em 5 dias) e arrisca perder regras como "este sistema falha em VERDE". Rejeitado.

## 2. Prefixo fixo e contexto

### 2.1 `autoCompactWindow: 300000` (maior ganho unitário)

Distribuição de custo por tamanho de contexto (5 dias):

| Contexto | Principal | Subagentes |
|----------|-----------|-----------|
| < 150K | 12% | 41% |
| 150K-300K | 26% | 43% |
| 300K-900K | 63% | 15% |

Simulação (`y_sim.py`): cada passo que ultrapassa W compacta para ~90K (prefixo 55K + resumo), custo da compactação = 8K tokens de saída
+ 90K de escrita no preço do TTL real; o que vem depois fica deslocado. Resultado líquido em 5 dias:

| W | Principal | Subagentes |
|---|-----------|-----------|
| 150K | +59 (111 compactações) | -295 (perde) |
| 200K | +92 | -46 (perde) |
| 250K | +100 | +18 |
| **300K** | **+93 (26 compactações)** | **+38 (130)** |
| 400K | +78 | +21 |

Em 300K ganha nos dois lados: ~US$ 131 em 5 dias = **~26/dia**. A 200K a principal ganha mais, mas subagente perde (compactar agente curto
custa mais do que lê). Como a chave é global, 300K é o ponto seguro. Também reduz as maiores reescritas do brief (280K a 764K tokens: o
"outro: compactação/retomada" soma US$ 80 em 5 dias; compactar a 300K reescreve ~90K, não 500K+).

Chave: `autoCompactWindow` top-level (inteiro, 100000 a 1000000 segundo o schema da 2.1.299; também `/autocompact`, `--autocompact`, env
`CLAUDE_CODE_AUTO_COMPACT_WINDOW`; há variante por modelo em `modelSettings`). Validado: `claude -p` com `{"autoCompactWindow":300000}` roda sem erro de schema.
Não consegui verificar o disparo real em `opus[1m]` (precisa sessão longa).

Premissas fracas da simulação: contexto pós-compactação de 90K e crescimento por passo igual ao original. Risco de qualidade: o resumo pode
descartar achado/estado; mitigação já existente (brief e saída em arquivo, relatório de 10 linhas). Também ajuda contra "context rot" citado no guia.

Mudança exata (`~/.claude/settings.json`, mesmo nível de `model`):

```json
  "autoCompactWindow": 300000,
```

Reverter: apagar a linha. Medir: `python3 ~/.claude/hooks/claude-custo.py 5` em 5 dias; esperar a fatia ">300K" da principal cair de 63% para ~0.

### 2.2 Desligar conectores claude.ai neste repo: ~US$ 4-7/dia, medido

O que o subagente carrega (log real de um agente de hoje): lista de ferramentas adiadas = 235 nomes, 10,7K chars (~3,5K tokens), dos quais
Notion 55, Gmail 23, Docs 5, Calendar/Drive/Linear 6 (conectores claude.ai) e 36 servidores de plugins sincronizados com 2 stubs
("authenticate"/"complete_authentication") cada. Uso em **30 dias, todos os projetos**: 9.797 chamadas ao chrome-devtools, 12 ao claude-in-chrome,
**zero** a qualquer conector claude.ai ou plugin de vendas/jurídico/etc.

Teste (`t5`): `{"disableClaudeAiConnectors": true}` tirou as 83 ferramentas Notion/Gmail/Docs da lista (o modelo listou só chrome-devtools e
cloudflare-docs) e o prefixo caiu de 35,4K para 31,3K tokens (-4,2K em modo headless). Valor por 1K tokens de prefixo, medido:
**US$ 1,76/dia por 1K** (subagentes US$ 7,94 + principal US$ 0,87 em 5 dias, somando escrita inicial e releitura de cada passo). Logo 2 a 4K tokens = 3,5 a 7 US$/dia.

Mudança exata (`.claude/settings.json` do repo; vale só aqui, quem precisar de Gmail/Notion em outro projeto não perde):

```json
  "disableClaudeAiConnectors": true,
```

Alternativa por variável: `"env": {"ENABLE_CLAUDEAI_MCP_SERVERS": "false"}`. Risco: o MCP "Claude Docs" que aparece nas instruções do harness some. Nenhum fluxo
do repo o usa. claude-in-chrome (extensão) e chrome-devtools (plugin) NÃO são afetados (continuaram na lista no teste).

### 2.3 Skills de plugins sincronizados da conta: ~US$ 6/dia, mecanismo local não confirmado

A lista de skills enviada a toda sessão e a todo subagente tem **30,3K chars (~8,5K tokens)** (anexo `skill_listing` do log).
Por plugin (chars): legal 3,2K, superpowers 2,9K, engineering 2,8K, product-management 2,7K, sales 2,2K, chrome-devtools-mcp 2,1K, design 2,0K,
supabase 1,7K, dataviz 1,4K, outros menores. Uso em 30 dias: frontend-design (50), superpowers (writing-plans 26, subagent-driven-development 13,
brainstorming 10, systematic-debugging 3, ...), workflow-authoring (5), copiar (3), claude-in-chrome, chrome-devtools. **Nenhuma** skill de
legal, sales, product-management, design, data, marketing, engineering, cowork-plugin-management, video-cut, supabase.

Removíveis: legal+sales+PM+design+data+marketing+engineering (sem `code-review`)+cowork ≈ 13K chars ≈ 3,7K tokens ≈ **US$ 6,5/dia**.

O que tentei e o que NÃO funcionou (importante, não aplicar às cegas):
- Esses plugins são do tipo "sincronizado da conta" (`~/.claude/plugins/synced/...`, `installationPreference: available`); `claude plugin list` nem os mostra.
- `enabledPlugins: {"sales@knowledge-work-plugins": false}` no `.claude/settings.json`: **sem efeito** (modelo ainda listou 36 skills sales).
- `CLAUDE_CODE_SYNC_PLUGINS=0`: sem efeito.
- `skillOverrides` (existe na 2.1.299: valores `on|name-only|user-invocable-only|off`): a chave certa é o nome **sem prefixo** (`forecast`, não
  `sales:forecast`), mas no teste o modelo continuou contando 36 skills `sales:`; o prefixo oscilou ±3K entre rodadas de linha de base (35,4K a 38,8K),
  então não consigo atribuir efeito. **Não confirmado.**
- O que desliga de verdade, quase certo: tirar os plugins no painel de plugins/personalizar da conta claude.ai (ação do dono, global). Os
  conectores `plugin_*_authenticate` (36 servidores) também somem por esse caminho.

Proposta: (a) o dono desliga esses plugins na conta; (b) se quiser tentar local, arquivo pronto em `yannis-skilloverrides.json` (88 nomes, `off`),
para mesclar em `.claude/settings.json` e conferir com `/context` ou `/skill-doctor` antes/depois; se o total da lista de skills não cair, reverter.
Atenção a colisão de nome: `competitive-brief` existe em marketing e PM (ambos desligados, ok); `code-review` (engineering) foi deixado de fora
porque colide com a skill embutida `/code-review`.

Mantidos de propósito (usados): frontend-design, superpowers, workflow-authoring, copiar, claude-in-chrome, chrome-devtools-mcp, dataviz, update-config etc.

### 2.4 Plugins globais já cobertos

`vercel`, `cloudflare`, `linear` já estão `false` no repo (medido: -4,6K tokens de prefixo). `supabase` (plugin) segue ligado: 0 usos de skill/MCP
em 30 dias (o repo usa a CLI); são só 1,7K chars de skills e um stub de MCP. Se for desligar: `"supabase@claude-plugins-official": false` em `enabledPlugins` do repo
(~0,5K tokens, ~US$ 1/dia). Phil usa a skill `supabase-postgres-best-practices` em revisão de migration, por isso deixo a decisão com ele.

### 2.5 CLAUDE.md e MEMORY.md

- `instructions` do log: 29.402 chars = CLAUDE.md 15.118 + MEMORY.md 14.315 (~8K tokens por sessão e por subagente).
- CLAUDE.md: 200 linhas, bem repartido, sem `@import`. Nada a ganhar (Pausa+Economia = 3,2K chars, só interessam à principal: mover para docs e deixar ponteiro
  economizaria ~0,4K tokens, ~0,7 US$/dia. Não vale o risco de subagente ignorar "nunca parado >4 min").
- MEMORY.md: 75 entradas. `project_*` = 32 entradas, 6,0K chars; `feedback_*` = 31, 5,7K; `reference_*` = 11, 2,0K. Entradas `project_*` de entregas fechadas
  (sprints 1b-4b, ecossistema 2026-07/09, CI verde, Next16, IG OAuth spec loop, etc.) podem ir para `memory/ARQUIVO.md` (fora do índice carregado),
  com 1 linha no MEMORY.md apontando. Corte de ~3 a 5K chars = 0,9 a 1,4K tokens = **US$ 1,5 a 2,5/dia**. Manter todos os `feedback_*`.

## 3. Saída ruidosa e leitura de arquivo grande

- **Teste/build/commit já estão filtrados na prática.** Em 5 dias: `npx vitest run` 114 chamadas, máximo 7,3K chars, total 0,15M chars; `git commit` ~1K chars em média
  (máx 14,8K uma vez); o hook PreToolUse faz `tail -30`. Total Bash = 131M chars, mas dominado por `python3 - <<EOF` de análise (3,4M), `grep -n`
  (1,4M), `sed -n 1,60p` de planos (várias centenas de milhares por padrão, mas é leitura intencional de plano em fatias). Nenhum comando de teste/build
  aparece entre os maiores. **Nada a acrescentar aqui.**
- `.husky/pre-commit` imprime `npm run build:packages 2>&1` e `tsc` inteiros no sucesso; hoje sai pouco (1K médio), mas é o único ponto sem filtro. Opcional,
  ganho desprezível: redirecionar para arquivo e imprimir só em falha.
- Leitura recorrente grande: `Read` de `.md` de plano/spec = 40M chars em 5 dias (1.308 leituras, ~31K chars cada). É o trabalho dos revisores (cada rodada
  relê o plano); não é deny-ável. A mitigação é a regra do guia "buscar antes de ler", que os briefs já pedem; sem ação mecânica.
- `Read` de PNG: 2.396 em 5 dias (~12M chars-equivalentes), maioria capturas de mockup (Gio/Naksu/Logan). Legítimo. Opcional: salvar capturas com largura
  <=1100px (hoje há `lista-1440.png`); uma imagem custa ~1 token por 28x28 px, cap ~4.800; 1440px de largura passa de 2K tokens por captura relida a cada passo.
- `Read` de `.diff`: 343 leituras (231 em 5 dias, 32K chars cada). Se forem diffs de revisão, pedir `git diff --stat` + arquivo a arquivo no brief.
- Deny rules novas: **não há evidência**. `node_modules` 15 leituras, `.next` 1, `dist` 12 em 30 dias; as regras atuais bastam. O `git status` de 187 chamadas
  com até 22,9K chars vem das centenas de `docs/superpowers/mockups/**/shots/` não rastreadas; ver abaixo.
- Menor: untracked em massa. Adicionar `docs/superpowers/mockups/**/shots/` e `*-shots/` a `.git/info/exclude` (ou commitar as capturas úteis)
  encolhe todo `git status` que agente roda e o bloco `gitStatus` do prompt. Ganho pequeno (~0,3 US$/dia), custo zero, mas as capturas são
  evidência do Gio: decisão do dono.

## 4. Itens do guia: já feitos, não se aplicam, faltantes

Já feito (não repetir): timer de 45 min e handoff (pausa-timer.sh), subagente não espera >4 min, modelo/effort explícitos, relatório de 10 linhas,
nunca "só mais uma coisa", fase nova = sessão nova, buscar antes de ler, navegador só em Sonnet, filtro de teste e saída para arquivo, `cleanupPeriodDays: 365`,
script de revisão mensal (`claude-custo.py`), status line com custo, contexto e hora de expiração do cache, CLAUDE.md <=200 linhas, Read deny de `dist/.next/coverage`.

Não se aplica aqui:
- "Script em vez de LLM recorrente": não há `claude -p` agendado (os LaunchAgents são Actions runner, StreamDeck, forja-enviar-sistemas, descarregador; a forja usa Gemma local).
  O repo já faz o contrário do vício do guia. Sem ação.
- "Cache de 1h para quem espera CI": ver 1.1.
- "Haiku para busca": ver 1.3.
- Fable: não usado.

Faltantes, ranqueados:
1. `autoCompactWindow` (2.1) e conectores (2.2): não estão em lugar nenhum do CLAUDE.md nem dos settings.
2. Rodar `/skill-doctor` e `/context` uma vez para confirmar a tabela de 2.3 (comando do próprio guia, grátis).
3. Limite de passos: 38 subagentes com >=100 passos custaram US$ 180 (12% do gasto de subagentes); p50 24 passos, p90 63, p99 158, máx 274. `maxTurns`
   existe no frontmatter, mas só vale para agentes nomeados (reviewers rodam 14 a 36 passos, nunca chegam perto). Para `general-purpose` o limite só
   pode ser instrução no brief ("pare e escreva handoff após 120 passos"). Ganho baixo; só vale se o brief-padrão já tiver espaço. Não prioritário.
4. Hook de `git commit` do repo roda um vitest por commit: custo em tempo, não em token. Ignorar.
5. Reescritas sem causa visível: 17 de subagente em <5 min sem evento correspondente no log (~US$ 14 em 5 dias) e 5 da principal ligadas a hooks de parada. Provável
   evicção/concorrência; não vale investigar agora (<3 US$/dia).

## 5. Não consegui verificar

- Disparo real do `autoCompactWindow` em `opus[1m]` e o efeito de qualidade do resumo (simulação, não execução).
- Se `skillOverrides` remove plugins sincronizados da lista que o modelo vê; só o painel da conta é certo.
- Variância de prefixo entre execuções headless (±3K), que limita a precisão das medidas de 2.3; 2.2 foi confirmado também pela lista de ferramentas.
- Preço por 1K de prefixo assume cache sempre quente após o primeiro passo (verdadeiro na maioria; reescritas por expiração somam ~10%).
- Se os 180 `workflow-subagent` (US$ 122 em Opus) usam Opus de propósito.
