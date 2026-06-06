# Research Strategist Rules — Critérios de Estratégia

> **Grupo:** estratégia. Estes são **thresholds calibráveis** — números, não dogmas.
> O Thiago pode ajustar qualquer valor abaixo a qualquer momento; o strategist passa
> a operar com o número novo na triagem, na proposta de foco e no digest.
> Posição no fluxo: `research → takeaway → decisão → foco`.

---

## Thresholds de Stale — research

| Sinal | Default | O que o strategist faz |
|---|---|---|
| `fresca` parada (sem virar `analise`) | **14 dias** | flag na triagem como "ler ou descartar" (Stale) |
| `fresca` parada — limite duro | **30 dias** | sugerir `arquivada` (não arquiva sozinho) |
| `analise` parada (sem takeaway que evolua) | **30 dias** | flag — RS1: ou gera takeaway ou arquiva |

**Por quê (RS1 + RS4):** research sem takeaway é ruído. `fresca` velha é dívida de leitura;
`analise` velha é dívida de decisão. O strategist surfaca, mas só o dono arquiva.

---

## Gatilho de PROPOR-FOCO

| Condição | Default | Ação |
|---|---|---|
| Research no mesmo `theme_id` sem foco `ativo` cobrindo o tema | **≥ 3 itens** | tema "maduro" → rascunhar foco `state:proposto` |
| Itens contam se `status` ∈ | `fresca`, `analise`, `aplicada` | `arquivada` não conta |

**Regra dura (RS2):** o Cowork **PROPÕE** (`manage_focos propose` → `state:proposto`).
**SÓ O DONO ATIVA** (`manage_focos activate`, que exige confirmação). Nunca ativar por conta própria.

---

## Idade do foco ativo — sugerir refresh

| Sinal | Default | Ação |
|---|---|---|
| Foco `ativo` rodando | **90 dias** desde `started_at` | sugerir revisão / novo foco |
| `window_label` venceu (ex.: "Q2 2026" já passou) | fim da janela | sugerir refresh, independente dos 90d |
| Foco `ativo` **sem nenhuma decisão** ligada | **> 30 dias** | flag em "Precisa da sua atenção" |

**Invariante single-active (RS2):** só pode existir **1 foco `ativo`**. Ao sugerir um novo,
o strategist sempre lembra que ativar o novo implica arquivar o atual.

---

## Completude de uma DECISÃO

Uma decisão só é considerada **completa** quando tem os três campos abaixo (RS3):

| Campo | Obrigatório | Por quê |
|---|---|---|
| `metric` | ✅ | decisão sem métrica não é mensurável — é opinião |
| `source_research_ids` (≥ 1) | ✅ | decisão precisa estar ancorada em research, não em achismo |
| `revisit` | ✅ | decisão sem data de revisão vira dogma esquecido |

Decisão sem qualquer um dos três → o strategist a marca como **incompleta** no DISTILL/REVIEW
e oferece preencher o que falta. Campos de apoio: `context`, `consequences[]`, `drives[]`, `history[]`.

### Revisit vencido (RS5)
`revisit` é dívida. Decisão `decidido`/`testando` com `revisit` no passado → sobe pro **topo**
do REVIEW e entra em "Precisa da sua atenção".

---

## Prioridade na triagem (TRIAGE table)

| Bucket | Condição | Ação |
|---|---|---|
| **Surface-now** | `pinned` OU `fresca` < 7d OU alimenta foco `agora` | ler / extrair takeaway |
| **Madura** | tema com ≥ 3 itens sem foco ativo | PROPOR-FOCO |
| **Stale** | `fresca` > 14d OU `analise` > 30d | flag / sugerir arquivar |
| **Backlog** | resto | fica quieto |

- **Horizonte = prioridade (RS4):** `agora` > `proximo` > `explorar` ao surfacar.
- **Tema pinado = quente (RS6):** research `pinned` no foco `ativo` tem prioridade máxima, sempre.

---

## Cadência do DIGEST

| Item | Default |
|---|---|
| Frequência do `summary_for_owner` | **semanal** |
| Disparo extra | quando há `revisit` vencido OU foco ativo sem decisão |

**Contexto sobre contagem (RS7):** todo digest diz **por quê**, não só quantos.
Nunca mais de **1 recomendação principal** por digest.

---

## Resumo dos números calibráveis (cheat-sheet)

| Parâmetro | Default | Ajustável? |
|---|---|---|
| Stale `fresca` → flag | 14d | sim |
| Stale `fresca` → sugerir arquivar | 30d | sim |
| Stale `analise` → flag | 30d | sim |
| Surface-now `fresca` | 7d | sim |
| PROPOR-FOCO (itens/tema) | ≥ 3 | sim |
| Refresh do foco ativo | 90d / fim do `window_label` | sim |
| Foco ativo sem decisão → flag | 30d | sim |
| Decisão completa | `metric` + `source_research_ids` + `revisit` | sim (mas RS3 recomenda manter os 3) |
| Cadência do digest | semanal | sim |
