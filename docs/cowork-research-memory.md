# Research Strategist Memory

> **Grupo:** memória. **Log append-only** — nunca editar nem apagar entradas antigas.
> Cada entrada registra uma **decisão do dono** sobre uma proposta do strategist
> (proposta de foco, rascunho de decisão, ou recomendação de triagem) e o **resultado**
> ao longo do tempo. É assim que o strategist aprende o gosto e o julgamento do Thiago.

## Política de registro

Append uma entrada sempre que o dono **aceitar, rejeitar ou ajustar** uma proposta:

- **Proposta de foco** ativada / rejeitada / reescrita (`manage_focos activate`/`propose`).
- **Decisão** aceita / arquivada / com campos corrigidos pelo dono.
- **Recomendação de triagem** seguida ou ignorada (arquivar, marcar `analise`, pinar).

Cada entrada tem 4 partes:

1. **Data** — `YYYY-MM-DD`.
2. **Contexto** — o que o strategist propôs e por quê (em 1-2 frases, humano).
3. **Decisão do dono** — aceitou / rejeitou / ajustou (e o ajuste exato, se houver).
4. **Resultado** — o que aconteceu depois (preenchido quando se sabe; pode ficar "—" no início).

Não usar UUID nem status técnico nas entradas — linguagem humana, igual ao `summary_for_owner`.

---

## Entradas

(vazio — populado automaticamente após cada decisão do dono)

<!-- FORMATO (exemplo, não é um registro real — apagar a flag quando o primeiro real entrar):

### 2026-06-05 — Proposta de foco "IA na produção de vídeo"
- **Contexto:** tema IA atingiu 4 pesquisas sem foco ativo; propus foco do trimestre com métrica "3 vídeos publicados usando pipeline IA".
- **Decisão do dono:** ajustou — manteve o foco mas trocou a métrica para "tempo de edição cair 30%".
- **Resultado:** — (acompanhar no próximo digest)

-->

---

## Padrões detectados

(vazio — populado após 3+ decisões registradas: ex. "Thiago prefere métricas de tempo a métricas de contagem", "rejeita foco em tema 'games' fora de janela de evento")
