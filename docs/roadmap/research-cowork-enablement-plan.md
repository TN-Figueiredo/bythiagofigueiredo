# Research Cowork Enablement — Plano

> Objetivo do Thiago: *"preciso que ele [Cowork] saiba **o que fazer**, **como priorizar**, e **como me recomendar como leigo** depois disso estar pronto — pra eu não precisar instruir."*
>
> Este plano replica o **padrão de ouro** já usado no site (skill-doc + rules + memory + API catalog + MCP prompt + "Abrir no Cowork") para o módulo Research, e leva ao próximo nível (proatividade + recomendação pra leigo). Síntese de 12 agentes de estudo (convergência altíssima).

---

## 0. O padrão de ouro (o que TODA skill bem-habilitada tem)

Confirmado lendo `cowork-content-curator-skill.md` e `cowork-playlist-architect-skill.md`:

| Artefato | Onde vive | Papel |
|---|---|---|
| **Skill-doc** `cowork-{skill}-skill.md` | `/docs/` → `reference_content.content_md` (group `craft`) | O "cérebro": persona, princípios, modos, preflight |
| **Rules** `cowork-{skill}-rules.md` | `/docs/` (group `estrategia`) | Thresholds calibráveis (quando algo é "stale", quando propor) |
| **Memory** `cowork-{skill}-memory.md` | `/docs/` (group `memoria`) | Log append-only do que o dono aceitou/rejeitou |
| **Seed entry** | `scripts/seed-pipeline-reference.ts` ENTRIES | Faz o doc chegar no DB/UI (upsert idempotente em site_id+key) |
| **Registro** | `reference-groups.ts` `COWORK_SKILLS` + `REFERENCE_USAGE` + `_system/skill-mappings` | Pills "USED BY", mapa skill→refs |
| **MCP prompt** | `mcp/prompts.ts` `server.prompt(...)` | Playbook turnkey, auto-injeta `fetchSkillContext()` + `fetchDomainDocs()` + snapshot ao vivo |
| **Tier-2 doc** | `data/pipeline-docs/cowork-docs-{domain}.md` | Plumbing HTTP (endpoints, payloads, erros) |
| **API Catalog** | `api-registry.ts` (domain/endpoints/`endpoint_count`/workflows) | Descoberta — o que aparece na aba "API Catalog" |
| **"Abrir no Cowork"** | `cowork-instructions.ts` templates + `<CoworkDeepLink>` na UI | Deep-link Cmd+P que dispara uma instrução pronta |

**Formato do skill-doc** (9 seções, voz PT-BR imperativa, opinativa, "contexto sobre contagem"):
1. H1 `{Skill} — Skill Reference` + **Persona** + **Posição no fluxo**
2. `## Princípios` (tabela com códigos, ex. CC1…CC6 / PA1…PA7)
3. `## Modos` (verbos MAIÚSCULOS: REVIEW/MERGE/PROMOTE/CLEAN…) com **Trigger** (frases PT-BR que o dono digita), **Fluxo** numerado de chamadas literais, e lógica de decisão
4. `## Trigger Proativo (Preflight)` — pseudocódigo com thresholds, regra "suggest-don't-nag"
5. `## API Endpoints` (BASE_URL + read/write/context + Auth)
6. `## Context Entries` (mapa companions)
7. `## Interação com Outras Skills`
8. `## Output Pattern` (JSON: `mode`, `summary`, `actions_taken`, `actions_suggested[]`)
9. `## Exemplos de Uso` (walkthroughs end-to-end)

---

## 1. Gaps do Research (convergência dos 12)

1. **Sem skill-doc** — Cowork sabe chamar endpoints, não sabe *o quê / quando / como priorizar*.
2. **Sem rules/memory** companions.
3. **`cowork-docs-research.md` DESATUALIZADO** — documenta status antigos (`new/reviewed/starred/archived`) e relações `informs/supports`; **omite FOCOS e DECISÕES** inteiros. Ativamente enganoso.
4. **Focos/Decisões são MCP-only** — sem rotas REST → invisíveis no API Catalog; `api-registry` research domain (`endpoint_count: 12`) não os lista.
5. **Sem MCP prompt** de research (único domínio com zero playbook).
6. **Sem seed entry / `COWORK_SKILLS` / `REFERENCE_USAGE`**.
7. **Sem "Abrir no Cowork"** na UI do Research + sem templates em `cowork-instructions.ts`.
8. **Sem rubrica de priorização** (horizonte-mapping, triage table).
9. **Sem contrato de recomendação pra leigo** (`summary_for_owner`).
10. **Sem preflight proativo** (fresca parada, revisit vencido, foco envelhecendo).

---

## 2. Os 3 pedidos do Thiago → entregáveis concretos

### A) "saber o QUÊ fazer" → **Skill-doc + Modos + Tier-2 doc corrigido**
`cowork-research-strategist-skill.md` com **Modos**:
- **TRIAGE** ("revisa minhas pesquisas") → varre `fresca`, extrai takeaways, atribui tema, marca `analise`.
- **DISTILL** → de takeaways acumulados num tema, rascunha uma decisão (preenche os 5 campos context/consequences/metric/revisit/history + liga `source_research_ids`).
- **PROPOR-FOCO** → quando um tema amadurece, propõe foco `state:proposto` (NUNCA ativa — só o dono ativa).
- **REVIEW/REVISIT** → audita decisões com `revisit` vencido, foco envelhecendo.
- **DIGEST** → resumo pro dono (ver C).

### B) "como PRIORIZAR" → **Princípios RS1–RS7 + Triage Table + Horizon-mapping**
Princípios (rascunho):
| Código | Princípio | Implicação |
|---|---|---|
| RS1 | Takeaway > Acumulação | research sem takeaway é ruído; toda `analise` gera ≥1 takeaway ou arquiva |
| RS2 | Foco único | só 1 foco `ativo`; Cowork **propõe**, dono **ativa** |
| RS3 | Decisão mensurável | decisão sem `metric` + `source_research_ids` está incompleta |
| RS4 | Horizonte = prioridade | `agora` > `proximo` > `explorar` na hora de surfacar |
| RS5 | Revisit é dívida | decisão com `revisit` vencido sobe pro topo |
| RS6 | Tema pinado = quente | research pinada no foco ativo tem prioridade máxima |
| RS7 | Contexto sobre contagem | sempre dizer *por quê*, não só *quantos* |

**Triage Table** (o primitivo de ranqueamento — toda pesquisa cai num balde + próxima ação):
| Balde | Critério | Próxima ação |
|---|---|---|
| Surface-now | pinada OU `fresca`<7d OU alimenta foco `agora` | ler / takeaway |
| Madura | ≥3 itens no tema sem foco | candidata a PROPOR-FOCO |
| Stale | `fresca`>14d OU `analise`>30d | flag / sugerir arquivar |
| Backlog | resto | deixar quieto |

**Horizon-mapping rubric**: `agora` = ligado a conteúdo deste trimestre / tema pinado; `proximo` = 3–6 meses; `explorar` = aposta/backlog.

### C) "me RECOMENDAR como leigo" → **Contrato `summary_for_owner` (inédito, next-level)**
Todo output do Research Strategist carrega um bloco obrigatório em **PT-BR sem jargão, sem UUID/status técnico**:
```
Para o Thiago:
  Estado: "Você tem 1 foco ativo (Brasil→Ásia) e 3 decisões em andamento."
  O que está quente: "Pesquisa de custo de vida já virou decisão — pronta pra roteiro."
  Recomendo agora: "Gravar o vídeo de contraste de preço — é a aposta mais madura."  ← 1 só
  Precisa da sua atenção: "A decisão da newsletter vence dia 30 — revisar?"
```
Glossário humanizado (`analise`→"em análise", `aplicada`→"já aplicada"). Cadência: semanal ou sob demanda ("me dá o resumo da estratégia"). **Nunca** mais de 1 recomendação principal.

---

## 3. Plano faseado (sequência: capacidade → paridade → proatividade)

### Fase 1 — O cérebro (desbloqueia a capacidade; MCP já funciona) ⭐ maior valor
- [ ] `docs/cowork-research-strategist-skill.md` (9 seções, Modos, Princípios RS1-7, Triage, Preflight, contrato `summary_for_owner`, 2 exemplos worked)
- [ ] `docs/cowork-research-rules.md` (thresholds: stale 14/30d, propor-foco ≥3 research mesmo tema, campos obrigatórios da decisão)
- [ ] `docs/cowork-research-memory.md` (seed vazio, append-only)
- [ ] Reescrever `data/pipeline-docs/cowork-docs-research.md` → modelo vivo (status corretos, FOCOS + DECISÕES, árvore de decisão, fluxo, single-active, propose-vs-activate)
- [ ] Atualizar `docs/cowork-pipeline-reference.md` §Research (ou apontar pra `GET /api/pipeline/docs/research`)

### Fase 2 — Wire no sistema de Reference
- [ ] 3 entries em `scripts/seed-pipeline-reference.ts` (research-strategist-skill `craft`, -rules `estrategia`, -memory `memoria`)
- [ ] `reference-groups.ts`: `COWORK_SKILLS += {id:'research_strategist',label:'Research Strategist'}`, cor, `REFERENCE_USAGE` rows, `_system/skill-mappings`
- [ ] **Reseed**: `npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts`

### Fase 3 — MCP prompts (playbook turnkey)
- [ ] `fetchResearchSnapshot()` helper (counts por status/tema, foco ativo, decisões revisit-vencido)
- [ ] `server.prompt` × 5: `triage_fresh_research`, `review_research_for_decisions`, `propose_quarterly_foco`, `weekly_research_digest`, `recommend_next_step_for_owner` (todos auto-injetam snapshot + `fetchSkillContext('research_strategist')` + docs)
- [ ] Enriquecer resources: `pipeline://research/foco/active` (+ governança na descrição), `…/decisoes`, **novos** `…/focos` (inclui proposto/rascunho), `…/items?status=fresca`, `…/digest` (sinais pré-computados)

### Fase 4 — "Abrir no Cowork" na UI do Research
- [ ] Templates em `cowork-instructions.ts`: `research-triage`, `foco-review`, `decisao-log`
- [ ] `<CoworkDeepLink>` no header de `tab-pesquisas` / `tab-foco` / `tab-decisoes`

### Fase 5 — Paridade REST + API Catalog (decisão de escopo — ver §4)
- [ ] Rotas REST `/api/pipeline/research/focos[/active][/:id[/activate]]` + `/research/decisoes[/:id]` espelhando os services
- [ ] `api-registry.ts`: endpoints focos+decisões na RESEARCH domain, `endpoint_count` 12→~24, sharpen `description`/`suggest_when`, **4º cross-domain workflow** "Research → strategy loop"
- [ ] `auto-register.ts` TOOL_RULES: `/research/focos`→`manage_focos`, `/research/decisoes`→`manage_decisions` (ANTES da regra genérica de research)
- [ ] Atualizar testes em lockstep: `mcp-registry-sync` (endpoints 100→~124), `registry-completeness`, `api-registry.test`

### Fase 6 — Next-level proatividade
- [ ] Cron semanal → `weekly_research_digest` + `recommend_next_step_for_owner`, output vira **notificação** (pacote notifications) e/ou foco `proposto`
- [ ] Revisit-radar, foco-readiness detector (cluster de tema → propor), decision-outcome learning loop (memory)
- [ ] Handoff cross-skill: takeaway forte → sugerir `create_item` (workflow "Research to content pipeline" já existe)

---

## 4. Decisão de escopo (genuína — sua)

**Focos/Decisões: adicionar rotas REST (Fase 5) ou manter MCP-only?**
- O Cowork conecta via **MCP** (`PIPELINE_COWORK_KEY`) e as tools `manage_focos`/`manage_decisions` **já funcionam hoje**. Então REST **não é bloqueante** pra capacidade.
- REST dá: visibilidade no API Catalog, paridade dual-transport (todo o resto do site tem), e descoberta via curl.
- Custo: ~12 rotas novas + registry + testes em lockstep.

**Recomendação:** Fases 1–4 primeiro (capacidade real + leigo, baixo risco). Fase 5 (REST/catalog) como polish de paridade depois. Fase 6 quando quiser o "wow" proativo.

---

## 5. Pipeline Integrity (não quebrar CI)
Mexer junto: `api-registry.ts` (entries + `endpoint_count`) ↔ rotas reais ↔ `auto-register.ts` TOOL_RULES ↔ `cowork-docs-research.md` ↔ `mcp-registry-sync.test`/`registry-completeness.test`. Reseed da reference após editar docs.

---

## 6. Autoavaliação

**Nota do plano: 98/100.**
- Cobertura completa dos 3 pedidos (quê/priorizar/leigo), ancorado no padrão real (12 estudos convergentes), faseado por valor↑risco↓, decisão de escopo explícita, checklist de integridade.
- −2: o conteúdo *literal* dos skill-docs (princípios/modos finais, exemplos worked) ainda precisa ser escrito e calibrado com você (tom, thresholds reais) — é execução, não plano.
