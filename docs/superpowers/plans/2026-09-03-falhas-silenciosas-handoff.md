# Falhas Silenciosas — Handoff da execução

**Executado:** 2026-09-02 / 03 · **Plano:** `2026-09-02-falhas-silenciosas.md` · **Spec:** `../specs/2026-09-02-falhas-silenciosas-design.md`
**Base:** `273c7a4c` → **HEAD:** `089726ea` (12 commits, não pushados)

Execução dirigida por sub-agentes: 11 implementadores, 10 revisores independentes, 3 ondas de correção. Nenhum pacote foi commitado sem revisão aprovada.

---

## O que entrou

| Commit | Pacote | O que fecha |
|---|---|---|
| `694464cf` | WP-A | Verbo GET em 8 rotas de cron agendadas que nunca executaram + teste-guarda |
| `9bfcdca3` | WP-K | Sync de analytics reportava `{synced:2, errors:0}` com a tabela vazia |
| `9fe841ae` | WP-D | Observatório calculava sobre dados congelados em 2026-07-08; 200 mudanças descartadas |
| `f2b99fbe` | WP-F | Criar pesquisa por API (bloqueador da ingestão do curso) |
| `50b8bda7` | WP-I | Segredo do HMAC separado da chave de transporte |
| `27c1a93e` | WP-C | Notificações marcadas como enviadas sem envio |
| `80204a93` | closer | Identidade da chave gravada no histórico |
| `1237a5a1` | WP-B | 10 rotas de cron órfãs registradas (`vercel.json` 39→50) |
| `194419ce` | WP-EG | Coaching do Cowork lido; máquina de estados fechada; auto-apply travado |
| `054363ad` | WP-H | `/api/health` + dead-man switch para a máquina caseira |
| `ba8e52c1` | fix 1 | Achados parqueados da revisão |
| `089726ea` | fix 2+3 | Achados da revisão final + regressão que a própria correção criou |

O teste-guarda de cron saiu de 79 para 101 casos — é ele que impede a classe inteira de voltar.

---

## Decisões que tomei no seu lugar

Se alguma estiver errada, é aqui que você desfaz.

**1. Sete implementadores em paralelo, contra a recomendação da skill.** Ela proíbe por risco de conflito; a análise de colisão do plano provou disjunção de arquivos e você pediu paralelismo máximo. Mitigação: nenhum agente commitou — eu revisei e commitei em série.
*Custo se errado:* retrabalho de merge manual num worktree só, visível e reversível.

**2. Aceitei o caminho de `one-embed.ts` fora de `src/`.** O plano mandava `apps/web/src/lib/supabase/`, que **não existe**. `tsconfig.json:35` mapeia `@/lib/supabase/*` para `./lib/supabase/*`. O plano estava errado.
*Custo se errado:* import irresolúvel — pego pelo typecheck, que passou.

**3. Aceitei `<` no lugar de `<=` em `computeSnapshotDelta`.** Meus testes codificavam 7 dias; `<=` entregava 6.
*Custo se errado:* delta semanal erra por um dia de views. Nota: a janela ancora no relógio, não no snapshot mais recente — ainda desanda se o sync atrasar.

**4. Exigi que `changed_by_key_id` fosse populado, não só criado.** A coluna existia e subia vazia; o critério do spec não estaria cumprido.
*Custo se errado:* uma onda a mais de trabalho.

**5. Mandei corrigir um teste que afirmava o comportamento defeituoso.** As fixtures de `notification-deliver` foram escritas para o "marca tudo como enviado sem enviar".
*Custo se errado:* perda de cobertura se o caso cobrisse algo legítimo — o revisor confirmou que não.

**6. Parqueei o truncamento em 200 vídeos da Analytics API.** É teto rígido da API, sem paginação possível. Hoje inofensivo (35 vídeos).
*Custo se errado:* passando de 200 vídeos ativos na janela, os de menos views somem sem aviso além do Sentry.

**7. Aceitei que a Opção C ficasse pela metade.** A guarda de auto-apply foi feita; a troca do algoritmo de vitória e o rename para "Tração inicial" viram pacote próprio, porque dependem de `youtube_video_analytics` encher.
*Custo se errado:* o eixo continua chamado CTR na tela por mais um ciclo, medindo zero — mas sem aplicar nada sozinho.

**8. Aceitei reusar `completed_reason: 'auto_resolve'`** para "sugerido, não aplicado", com `applied_by: null` como sinal. Valor novo exigiria migration fora de escopo.
*Custo se errado:* alguém lê `auto_resolve` no banco e assume que foi aplicado.

**9. Aceitei a instrumentação dos dois `logger.ts`.** Meu contrato autorizava um só, que cobre 6 das 31 rotas — obedecer entregaria um quinto do pacote.
*Custo se errado:* gravação duplicada em rota que resolva os dois; upsert é idempotente.

**10. Tirei `unknown` do agregado do `/api/health`.** Contava como não-ok e o dead-man switch nasceria em fadiga de alarme no dia 1.
*Custo se errado:* **ver pendência 5 abaixo — esta é a que mais merece sua atenção.**

**11. Desviei do protocolo para fazer uma terceira onda de correção.** A skill diz que não há. Fiz porque os defeitos eram **nossos**, não pré-existentes: a instrumentação converteu omissão silenciosa em afirmação falsa de saúde.
*Custo se errado:* uma terceira onda pode introduzir uma terceira regressão — já aconteceu uma vez nesta sessão.

**12. Parei no `ab-watchdog`.** Mesma classe, linhas 27 e 77, mas já gravava saúde antes deste trabalho e não foi tocado. Critério: consertar o que quebramos, documentar o que já estava quebrado.
*Custo se errado:* uma rota segue afirmando saúde sobre erro não olhado.

---

## O padrão sistêmico que este trabalho criou sem querer

Vale no `CLAUDE.md`, porque vai acontecer de novo:

> **Instrumentar saúde numa rota que faz `const { data } = await supabase...` sem checar o `error` transforma silêncio em mentira.** Uma falha de query produz `data === null`, o código conclui "nada a processar" e passa a **gravar sucesso**. Antes era omissão; depois é afirmação falsa. Quem instrumentar rota nova checa o `error` primeiro.

Apareceu em 5 rotas, todas corrigidas: `optimization-monitor`, `sync-youtube` (dois branches), `ab-backfill`, `expire-notifications`. Pré-existente e não corrigido: `ab-watchdog:27,77`.

---

## Pendências — só você pode fechar

**1. As três migrations de segurança (bloqueia o push).** Rode no SQL Editor de produção:

```sql
select version, name from supabase_migrations.schema_migrations
where version in ('20260703000001','20260703000002','20260703000003') order by version;
```

Zero linhas = nenhuma aplicada. Uma delas corrige nove funções `SECURITY DEFINER` sem `search_path`. Aplicar com `npm run db:push:prod`.

**2. A migration nova precisa ir junto com o deploy.** `20260903000001_pipeline_history_key_identity.sql`. O código já grava `changed_by_key_id`; sem a coluna, todo `graduate`/`publish`/`restore` lança `DB_ERROR`.

**3. `PIPELINE_MCP_HMAC_SECRET` antes do deploy.** `openssl rand -hex 32`, no `.env.local` e na Vercel. Invertido, `getHmacSecret()` lança e derruba as tools MCP.

**4. Teto de crons da Vercel.** Passamos de 39 para 50. Nenhum agente achou o número no repo. Se o build recusar, consolidar rotas de baixa frequência — nunca remover instrumentação.

**5. Decisão de produto: o que merece te acordar?** Duas lacunas ficaram, e são de limiar, não de código:
- **`unknownCount` não tem consumidor.** Um cron agendado que nunca gravou linha nenhuma fica `unknown` para sempre e não alarma em lugar nenhum. Trocamos alarme falso por silêncio. Depois de quantos dias um cron desconhecido deve notificar?
- **`dead > 0` é mudo.** Notificação que esgota tentativas não gera sinal — nem HTTP, nem `cron_health`, nem Sentry. E a rota reporta `ok` com 49 de 50 falhando. Que taxa de falha merece sinal?

**6. Contas Meta vencidas desde 2026-07-18.** `facebook` e `instagram` sem refresh token. Publicação em social não funciona mesmo com o cron agora vivo.

**7. Validar o watchdog de verdade.** `docs/ops/cron-watchdog/` tem o script e a unit systemd. O teste que importa não é o unitário: é desligar um cron e confirmar que chega notificação no celular. Dead-man switch que nunca disparou não está validado.

---

## Trabalho futuro registrado

- **WP-L:** trocar o algoritmo de vitória do A/B Lab por velocidade de views e renomear o eixo para "Tração inicial". Depende de `youtube_video_analytics` encher (WP-K em produção).
- **Ingestão do curso:** transcrições na Research Library, síntese curta em `reference_content`. Desbloqueada por `f2b99fbe`.
- **A terceira categoria no guardrail** (`prompt-builders.ts:43`): doutrina citável com procedência.
- **O worker na forja** que drena a fila de inteligência. A task só aceita um PATCH antes de sair de `running` — a revisão vem antes do envio.
- `optimization_cycles`: `test_suggested` e `testing` seguem inalcançáveis; nada liga o ciclo a um `ab_test_id`.
- Auditoria de deletes em research, context e playlists — não gravam histórico nenhum.
