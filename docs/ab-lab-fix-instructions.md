# Instruções para o Claude Code — Consertar e completar o **A/B Lab** (`/cms/youtube/ab-lab`)

> Contexto: CMS bythiagofigueiredo (Next.js 15 · React 19 · Tailwind 4 · Supabase). Este doc descreve problemas observados na implementação atual do A/B Lab e o que precisa ser corrigido/completado. **Antes de editar, leia os arquivos reais** do feature (rota `app/cms/(authed)/youtube/ab-lab/`, serviços em `lib/youtube/`, tabelas `ab_tests`, `ab_test_variants`, `ab_test_cycles`, e `lib/youtube/notification-service.ts`). Use os tokens/UI já existentes (`cms-ui`, `lucide-react`, `text-cms-text`, `bg-cms-surface`, cores `cms-*`).

---

## Estado atual (das screenshots)

**Tela 1 — lista (`/youtube/ab-lab`)**: header "A/B Lab" + subtítulo + ícone de engrenagem. Um único bloco "DRAFT IN PROGRESS" com um card ("Test: Sukhumvit Road… · Stopped at step 4 of 5 · 8h ago · Continue setup"). Resto da página vazio.

**Tela 2/3 — detalhe do teste**: badges `COMBO` + `COMPLETED`; botões Duplicate/Download. Hero verde com troféu mostrando vencedor **"A · 0.0% · 0.0% confidence"** e `0 Impressions / 0 Cycles / 0 Extra clicks/mo`. Seção "WHY A WON" com "CREDIBLE INTERVALS" (vazio) e "WIN PROBABILITY" (A/B/C/D todos 0%). "CONFIDENCE TREND: No data yet", "LEARNING: No learning recorded". "FINAL SCOREBOARD" (A/B/C/D todos 0.0%). "DECISION GATES 0/6 passed" (confidence 0/95%, min_impressions 0 need 1000, min_duration 0/7d, min_cycles 0/28, burn_in 0, stability 0/3).

**Tela 4 — painel de settings**: slide-out "A/B Test Settings" com apenas uma opção: AUTOMATION → "Auto-apply winner".

---

## Problemas (em ordem de prioridade)

### P0 — Bloqueadores de uso

1. **Não existe forma de iniciar um novo teste A/B.** Não há CTA "Novo teste" em lugar nenhum. É a falha mais grave — o usuário não consegue criar testes pela tela.

2. **Estado do teste é contraditório / enganoso.** Um teste com **0 impressões e 0 ciclos** aparece como `COMPLETED` com um **vencedor verde "A" e "0.0% confidence"**, e ao mesmo tempo "DECISION GATES 0/6 passed · 7 days remaining". Isso é incoerente: ou o teste terminou (e então mostra vencedor real), ou não tem dados (e então não pode declarar A vencedor). A máquina de estados e os rótulos estão errados.

3. **"WHY A WON" / hero de vencedor aparecem sem vencedor real.** Declarar "A venceu com 0.0%" é falso. Só mostrar narrativa de vencedor quando houver vencedor estatisticamente válido.

### P1 — Telas incompletas / quebradas

4. **Visualizações vazias renderizam como buracos quebrados**, não como estados desenhados: "CREDIBLE INTERVALS" é uma caixa vazia; "WIN PROBABILITY" são barras a 0%; "CONFIDENCE TREND: No data yet"; "LEARNING: No learning recorded". Parece bug, não "aguardando dados".

5. **Lista pobre e desorganizada.** Só mostra "Draft in progress". Não há seções/abas para **Ativos**, **Rascunhos** e **Concluídos**, nem histórico, nem estado vazio com orientação.

6. **Sem sugestões nem contexto.** O usuário pediu "sugestões e mais informações". Não há: sugestões de quais vídeos testar, explicação do que cada métrica significa, nem o que fazer a seguir.

7. **Painel de Settings raso.** Só tem "Auto-apply winner". Faltam os defaults que governam os próprios Decision Gates (confidence threshold, min impressions, min duration, min cycles, burn-in, estabilidade, cadência de rotação, nº de variantes, canais).

### P2 — Ações e polish

8. **Detalhe sem ações primárias.** Tem Duplicate/Download, mas falta Iniciar/Pausar/Encerrar/Aplicar vencedor conforme o estado.
9. **Sem tooltips/explicações** nas métricas (confidence, credible intervals, cycles, burn-in, stability).
10. **Integração com notificações** (test_completed, winner_declared, retest_suggested, inconclusive) — confirmar que dispara via `createNotification`.

---

## O que implementar

### 1. Iniciar novo teste (P0)

- Adicionar botão primário **"Novo teste A/B"** no header da lista (ao lado da engrenagem). Cor accent (coral), ícone `flask`/`plus`.
- Abrir o **wizard de setup já existente** (o draft "stopped at step 4 of 5" indica que há um fluxo de N passos). Reaproveitar esse wizard; só faltava o ponto de entrada. Passos sugeridos:
  1. Escolher vídeo (com busca; pré-listar candidatos — ver §4).
  2. O que testar: thumbnail / título / descrição / combo.
  3. Adicionar variantes (2–4): upload de thumb e/ou variações de título.
  4. Parâmetros (herdar defaults das Settings; permitir override): duração, min impressões, confiança-alvo, cadência.
  5. Revisar & iniciar.
- Estado vazio da lista (quando não há nenhum teste) deve ter ilustração + copy + esse mesmo CTA: "Crie seu primeiro teste A/B para descobrir qual thumbnail/título maximiza o CTR."

### 2. Corrigir a máquina de estados e o hero (P0)

Defina estados explícitos e renderize o hero conforme cada um:

| Estado | Quando | Hero mostra |
|---|---|---|
| `draft` | setup incompleto | "Rascunho — continue a configuração" + botão Continuar |
| `running` | publicado, coletando | progresso (impressões/ciclos), "Coletando dados · dia X de Y", **sem** vencedor |
| `inconclusive` | atingiu duração máx. sem confiança | "Inconclusivo — sem diferença significativa" (neutro, **não** verde) |
| `resolved` | gates passaram, vencedor válido | hero verde com vencedor real + confiança real |
| `applied` | vencedor aplicado | "Variante X aplicada" |

- **Nunca** rotular como `COMPLETED` + vencedor um teste com 0 dados. Se 0 impressões/0 ciclos e gates 0/6 → estado é `draft` ou `running`, jamais `resolved`.
- O número grande do hero deve ser o CTR/uplift do vencedor **somente** quando `resolved`; caso contrário, mostrar a métrica de progresso (ex.: "32% dos dados necessários").

### 3. Estados "aguardando dados" desenhados (P1)

Substituir todos os vazios por componentes intencionais (mesmo padrão de empty/skeleton do resto do CMS):
- **Credible intervals / Win probability / Confidence trend**: quando sem dados, mostrar placeholder com ícone + "Aguardando impressões — os gráficos aparecem quando o teste começar a coletar". Se `running` mas ainda raso, mostrar skeleton/curva parcial.
- **Learning**: "Nenhum aprendizado registrado ainda. Após resolver, o resumo do que funcionou aparece aqui."
- **Scoreboard**: ok manter a tabela, mas com hint de que valores zerados = sem dados.

### 4. Sugestões de teste + contexto (P1)

- Na lista, adicionar seção **"Sugestões de teste"**: vídeos candidatos puxados do analytics do YouTube — priorizar **alta impressão + CTR abaixo da média** e **vídeos sem teste recente**. Reaproveitar os triggers que já existem em `lib/youtube/intelligence-types.ts` / `notification-service.ts` (`retest_suggested`, `optimization_available`, `ctr_drop`). Cada sugestão = card com thumb, título, CTR atual, motivo ("CTR 3.2% — abaixo da sua média de 6.8%") e botão "Testar".
- Header com link "Como funciona o A/B Lab" (drawer/modal curto explicando ciclos, burn-in, confiança).

### 5. Organizar a lista (P1)

- Abas/seções: **Ativos** · **Rascunhos** · **Concluídos** (com contagem). Cards consistentes: thumb, título, estado (badge colorido por estado), métrica-chave (uplift ou progresso), tempo, ação contextual.
- Manter o card "Continue setup" dentro de Rascunhos.

### 6. Painel de Settings completo (P1)

Expandir "A/B Test Settings" além de Auto-apply. Esses valores devem **alimentar os Decision Gates** (hoje hardcoded em 95%/1000/7d/28/burn-in/3):
- **Automação**: Auto-apply winner (já existe); Auto-pausar variante perdedora; Notificar ao resolver.
- **Critérios de decisão (defaults)**: Confiança-alvo (default 95%); Min. impressões por variante (1000); Duração mínima (7 dias); Min. ciclos (28); Burn-in (período inicial ignorado); Estabilidade (N avaliações consecutivas, default 3).
- **Rotação**: cadência de troca de variante; nº máximo de variantes (2–4).
- **Notificações** do A/B (liga ao sistema de notificações): test started, winner declared, inconclusive, retest suggested.
- Persistir em `AbTestSiteSettings` (já existe `notifications` flags) por site.

### 7. Ações no detalhe + tooltips (P2)

- Header do detalhe com ações contextuais por estado: `draft`→Continuar/Excluir; `running`→Pausar/Encerrar agora/Editar variantes; `resolved`→Aplicar vencedor/Duplicar; sempre Download.
- Tooltips (ícone "info") em: Confiança, Intervalos de credibilidade, Ciclos, Burn-in, Estabilidade, Chance de vencer.

---

## Critérios de aceite

- [ ] Existe botão "Novo teste A/B" funcional na lista que abre o wizard e cria um teste.
- [ ] Nenhum teste com 0 dados aparece como `COMPLETED`/vencedor; estados refletem a realidade (draft/running/inconclusive/resolved/applied).
- [ ] "WHY A WON"/hero verde só aparecem com vencedor estatisticamente válido.
- [ ] Gráficos vazios mostram estados "aguardando dados" desenhados, não buracos.
- [ ] Lista organizada por Ativos/Rascunhos/Concluídos, com estado vazio + CTA.
- [ ] Seção de sugestões de teste com candidatos reais do analytics.
- [ ] Painel de Settings com todos os critérios de decisão, persistidos e refletidos nos Decision Gates.
- [ ] Ações contextuais por estado no detalhe + tooltips nas métricas.
- [ ] Eventos disparam notificações via `createNotification` (test started/winner/inconclusive/retest).
- [ ] Usa tokens e componentes do design system existente; passa em dark + light.

## Não fazer
- Não inventar dados nem mascarar estado vazio com números fake.
- Não quebrar o schema `ab_tests`/`ab_test_*` existente — estender, não substituir.
- Não duplicar o sistema de toasts; usar `useToast()` do `cms-ui`.
