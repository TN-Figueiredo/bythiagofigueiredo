# Licensing — Next Steps (Checklist de Conclusão)

> **Criado:** 2026-04-16
> **Estado atual:** Drafts produzidos e commitados em `licensing/` (commits `a224d05` + `5921503`). Pre-work legal (Fase 0) é o próximo bloqueador.
> **Tempo ativo restante estimado:** ~20-25h espalhadas em 6 meses.
> **Custo estimado:** R$ 2k (baseline) a R$ 6k (completo) ano 1.
> **Referências:**
> - Spec: `docs/superpowers/specs/2026-04-16-ecosystem-licensing-design.md`
> - Plan: `docs/superpowers/plans/2026-04-16-ecosystem-licensing-impl.md`

---

## 🟢 JÁ FEITO (reference — não precisa reabrir)

- [x] Brainstorm em 7 seções com recursive self-critique até 98/100
- [x] Spec commitado (548 linhas) em `docs/superpowers/specs/`
- [x] Plan commitado em `docs/superpowers/plans/`
- [x] 22 arquivos em `licensing/` (8 templates + 6 runbooks + 3 scripts + README + registry.csv + 3 .gitkeep + ROPA)
- [x] LICENSE v1.2 draft (21 artigos PT-BR, SPDX `LicenseRef-Proprietary-FigueiredoTech-v1`)
- [x] CI step com `continue-on-error: true` em `.github/workflows/ci.yml`
- [x] Domínio canônico alinhado pra `bythiagofigueiredo.com`

---

## 🔴 FASE 0 — Pre-work legal (BLOQUEANTE — fazer primeiro)

**Ordem recomendada:** aliases → advogado em paralelo com placeholders.

### 0.1 Aliases de e-mail (15 min, R$ 0)

- [ ] Escolher provider: **Cloudflare Email Routing** (free, ilimitado se domínio DNS já tá no CF) ou **Zoho Mail Free** (5 usuários).
- [ ] Configurar DNS do `bythiagofigueiredo.com` (MX + TXT) no provider escolhido.
- [ ] Criar aliases encaminhando pro teu e-mail pessoal:
  - `licensing@bythiagofigueiredo.com` → intake + notificações gerais
  - `security@bythiagofigueiredo.com` → disclosure de vulnerabilidades
  - `juridico@bythiagofigueiredo.com` → notificações formais + LGPD
  - `privacidade@bythiagofigueiredo.com` → direitos LGPD dos titulares
- [ ] Testar cada alias enviando e-mail de outra conta.

### 0.2 Advogado de PI (1-2 semanas elapsed, ~R$ 800-1.500 ativo)

- [ ] Escolher advogado: **Baptista Luz** (SP, boutique TI), **Peduti** (SP, PI/tech), **Murta Goyanes** (PI tradicional), ou conhecido teu.
- [ ] Enviar handoff package (zip com estes arquivos):
  - `licensing/templates/LICENSE-v1.txt`
  - `licensing/templates/master-agreement.md`
  - `licensing/templates/annex-a.md`
  - `licensing/templates/nda-flowdown.md`
  - `licensing/templates/cession-template.md`
  - `licensing/templates/ropa-licensing.md`
  - `licensing/templates/authorization-request.md`
  - `licensing/templates/termination-notice.md`
- [ ] Pedir parecer específico sobre:
  - Cláusula penal (R$ 50k) vs porte de parceiros previstos
  - Exclusão de CDC (Art. 11.4) efetiva em B2B PJ↔PJ
  - Cláusula anti-IA training (Art. 6.1 e) defensibilidade
  - Cessão PF→PJ: melhor via integralização de capital (evita IR/ISS) vs onerosa
  - Validade do click-wrap no contexto do portal self-service futuro (Seção 7)
- [ ] Aplicar ajustes → salvar como LICENSE v1.3 + Master v2 no mesmo path.
- [ ] Commit: `docs(licensing): apply lawyer review — v1.3`.

### 0.3 Placeholders (30 min, R$ 0)

- [ ] **Endereço da Figueiredo Technology LTDA:** pegar do Cartão CNPJ ou última alteração contratual da Junta Comercial SP. Substituir `[endereço cadastrado na Junta Comercial]` em:
  - `licensing/templates/LICENSE-v1.txt`
  - `licensing/templates/master-agreement.md`
  - `licensing/templates/termination-notice.md`
  - `licensing/templates/cession-template.md`
- [ ] **CPF de Thiago Figueiredo** em `licensing/templates/cession-template.md`.
- [ ] **Data atual** em todos os templates se passar de 2026-04-16.

### 0.4 Confirmações com contador (1h, R$ 0)

- [ ] Confirmar enquadramento da Figueiredo Technology: **ME** (Microempresa, receita ≤ R$ 360k/ano) ou **LTDA normal**? Afeta taxa INPI (R$ 355/classe vs R$ 415/classe) e copyright.
- [ ] Decidir forma da cessão PF→PJ: **integralização de capital social** (recomendado — sem IR/ISS) via alteração contratual, vs onerosa com NF.

### 0.5 Decisões de design (30 min, R$ 0)

- [ ] **Cláusula penal do irmão:** R$ 20k no Anexo A #001 dele (calibrado pro porte), ou manter R$ 50k do default? Spec recomenda R$ 20k pra intragrupo.
- [ ] **Modelo comercial com irmão:** confirmar Modelo C (gratuito ano 1 → renegocia ano 2). Alternativa: Modelo A puro (gratuito sem renegociação planejada).
- [ ] **Existência de logomarca Figueiredo Technology:** se existe, priorizar depósito figurativa (Fase 6). Se não, criar primeiro ou pular por enquanto.

---

## 🟡 FASE 1 — LICENSE rollout em 32 packages (4h ativo)

**Pré-requisito:** Fase 0 completa (LICENSE v1.3 aprovada pelo advogado).

- [ ] Clonar ou trocar working directory pro repo `tnf-ecosystem` (onde vivem os 32 packages).
- [ ] Copiar `licensing/templates/LICENSE-v1.txt` (versão v1.3 aprovada) pro `tnf-ecosystem/licensing-templates/LICENSE-v1.txt` (cópia canônica local).
- [ ] Copiar `licensing/scripts/rollout-license.sh` pro `tnf-ecosystem/scripts/`.
- [ ] Rodar: `bash scripts/rollout-license.sh`.
- [ ] Revisar `git diff` — 32 packages alterados (LICENSE + package.json `license` + `files`).
- [ ] Rodar: `npm run typecheck && npm test` (não deve quebrar nada).
- [ ] Criar branch `chore/license-v1-rollout`.
- [ ] Commit: `chore(license): apply proprietary LICENSE v1 to all 32 packages`.
- [ ] Abrir PR, revisar, merge.

---

## 🟡 FASE 2 — CI guardrails (2h ativo)

**Pré-requisito:** Fase 1 merged.

- [ ] No `tnf-ecosystem`: adicionar `scripts/check-license.sh` (cópia de `bythiagofigueiredo/licensing/scripts/check-license.sh`).
- [ ] Adicionar step ao `.github/workflows/ci.yml` do `tnf-ecosystem`:
  ```yaml
  - name: Check proprietary LICENSE integrity
    run: bash scripts/check-license.sh
  ```
- [ ] No repo `bythiagofigueiredo`: **remover** `continue-on-error: true` do step "Check proprietary LICENSE integrity" em `.github/workflows/ci.yml` (já adicionado, aguarda Fase 1 completar).
- [ ] Setup pre-commit hook (husky ou lefthook):
  ```
  scripts/check-license.sh
  ```
- [ ] Testar regressão: remover LICENSE de 1 package localmente → pre-commit bloqueia → revert.

---

## 🟡 FASE 3 — Legacy MIT bump (2h ativo)

**Pré-requisito:** Fase 1 merged.

- [ ] `packages/cms/package.json`: bump `0.2.0` → `0.3.0`.
- [ ] `packages/email/package.json`: bump `0.1.0` → `0.2.0`.
- [ ] Escrever entrada em `packages/cms/CHANGELOG.md`:
  ```markdown
  ## 0.3.0 (YYYY-MM-DD)

  ### 🚨 BREAKING: LICENSE CHANGED

  This package was previously MIT. Starting with v0.3.0, it is proprietary
  software under `LicenseRef-Proprietary-FigueiredoTech-v1`.

  Versions ≤ 0.2.x remain MIT-licensed. Future use requires explicit
  written authorization from Figueiredo Technology LTDA.

  Contact: licensing@bythiagofigueiredo.com
  ```
- [ ] Idem `packages/email/CHANGELOG.md` (ajustando versões 0.1.0 → 0.2.0).
- [ ] Banner em `packages/cms/README.md` e `packages/email/README.md`:
  ```markdown
  > **⚠️ LICENSE CHANGED (YYYY-MM-DD).** Versões ≥ 0.3.0 (cms) / ≥ 0.2.0 (email)
  > são proprietárias. Versões anteriores permanecem MIT.
  > Ver [LICENSE](./LICENSE).
  ```
- [ ] `npm publish` ambos packages (com `NPM_TOKEN` no env).
- [ ] Deprecate versões antigas:
  ```bash
  npm deprecate '@tn-figueiredo/cms@0.2.0' \
    'LICENSE CHANGED in 0.3.0+. This version remains MIT. See 0.3.0+ for proprietary terms.'
  npm deprecate '@tn-figueiredo/email@0.1.0' \
    'LICENSE CHANGED in 0.2.0+. This version remains MIT. See 0.2.0+ for proprietary terms.'
  ```
- [ ] No `bythiagofigueiredo`: atualizar pin em `apps/web/package.json`:
  ```bash
  npm install @tn-figueiredo/cms@0.3.0 @tn-figueiredo/email@0.2.0 \
    --workspace=apps/web --save-exact
  ```
- [ ] Testar: `npm test --workspace=apps/web && npm run build --workspace=apps/web`.
- [ ] Commit + PR + merge no `bythiagofigueiredo`.
- [ ] E-mail direto ao irmão (único outro consumer conhecido) anunciando a mudança.

---

## 🟡 FASE 4 — Archive repo bootstrap (3h ativo)

**Pré-requisito:** Fase 0 completa (tem os templates finais).

- [ ] No GitHub: criar repo **privado** `TN-Figueiredo/licensing-archive`, 0 collaborators.
- [ ] Clonar localmente.
- [ ] Copiar conteúdo de `licensing/` (deste repo) pro root do `licensing-archive`:
  - `templates/` (8 arquivos)
  - `runbooks/` (6 arquivos)
  - `scripts/` (3 arquivos — incluir `backup-workflow.yml` em `.github/workflows/backup.yml`)
  - `README.md`
  - `registry.csv`
  - `partners/.gitkeep`, `compliance/.gitkeep`, `audit/.gitkeep`
  - `NEXT-STEPS.md` (este arquivo, pode servir de log histórico)
- [ ] Habilitar **2FA obrigatório** na tua conta GitHub (Settings → Password and authentication → Two-factor authentication).
- [ ] Criar conta Backblaze B2 (free 10GB — mais que suficiente). Criar bucket `figueiredotech-licensing-archive` (private).
- [ ] Gerar **BACKUP_PASSPHRASE** forte (32+ caracteres). Armazenar:
  1. 1Password Vault pessoal.
  2. Cópia física impressa (gaveta trancada / cofre).
  3. GitHub Secret do repo `licensing-archive` (apenas pro workflow).
- [ ] Gerar **B2 Application Key** (escopo: bucket específico, write-only se possível).
- [ ] GitHub Secrets no repo `licensing-archive`:
  - `BACKUP_PASSPHRASE`
  - `B2_KEY_ID`
  - `B2_APP_KEY`
  - `B2_BUCKET=figueiredotech-licensing-archive`
- [ ] Trigger backup manual: Actions → Weekly backup → Run workflow (workflow_dispatch). Verificar que arquivo chegou no B2.
- [ ] Setup bucket lifecycle rule: retention 10 anos.
- [ ] Primeiro commit no `licensing-archive`: `chore: bootstrap archive from bythiagofigueiredo/licensing`.

---

## 🟡 FASE 5 — First partner (irmão) (1 semana elapsed, 4h ativo)

**Pré-requisito:** Fases 0 + 4 completas.

### 5.1 Preparação

- [ ] Preencher `licensing/templates/annex-a.md` versão específica do irmão:
  - Partner slug: `irmao-tech` (ou similar)
  - Seção 1: packages que ele consome (admin + deps)
  - Seção 2: projetos (nome + domínio + finalidade)
  - Seção 3: usuários (irmão + colaboradores com CPF+email+função)
  - Seção 4: restrições (se houver)
  - Seção 5: Modelo C (gratuito ano 1)
  - Seção 6: controle técnico padrão
- [ ] Preencher `licensing/templates/master-agreement.md` versão específica do irmão.
- [ ] Preencher cláusula penal calibrada (R$ 20k se for a decisão).
- [ ] Gerar PDFs via pandoc:
  ```bash
  pandoc master-agreement.md -o master.pdf --pdf-engine=xelatex
  pandoc annex-a.md -o annex-a-001.pdf --pdf-engine=xelatex
  ```

### 5.2 Envio + assinatura

- [ ] Criar conta Clicksign (R$ 5-10/doc, ~R$ 50/ano pra uso baixo) ou D4Sign.
- [ ] Enviar Master + Anexo A #001 pra assinatura eletrônica com:
  - Titular (tu)
  - Irmão (representante legal)
  - 2 testemunhas tuas
- [ ] Enviar `nda-flowdown.md` em separado pro irmão repassar a cada colaborador.
- [ ] Aguardar: irmão coleta NDAs dos colaboradores + envia cópias digitalizadas.

### 5.3 Onboarding técnico

- [ ] No GitHub: Settings → Developer settings → Personal access tokens → Fine-grained → Generate new token. **2 tokens**:
  - **PAT-DEV (180d expiry):** scope repo `tnf-ecosystem`, permissions `Contents: Read`, `Packages: Read`.
  - **PAT-CI (180d expiry):** mesmo scope.
- [ ] Enviar PAT-DEV ao irmão por e-mail criptografado (age/GPG) ou Bitwarden Send (expira 72h).
- [ ] Enviar PAT-CI ao irmão via canal separado (Clicksign mesmo, ou link diferente).
- [ ] No repo `tnf-ecosystem`: Settings → Collaborators → Add → irmão (GitHub username) como **outside collaborator** com permission `Read`.
- [ ] Adicionar cada colaborador listado no Anexo A #001 como outside collaborator também (Read only).
- [ ] No irmão: orientar setup do `.npmrc`:
  ```
  @tn-figueiredo:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${NPM_TOKEN}
  ```

### 5.4 Arquivamento

- [ ] No `licensing-archive/partners/irmao-tech/`:
  - `master-agreement-signed.pdf` (do Clicksign)
  - `annexes/001-YYYY-MM-DD.pdf`
  - `ndas/<user-cpf-last4>-YYYY-MM-DD.pdf` (um por colaborador)
- [ ] Append em `licensing-archive/registry.csv`:
  ```csv
  irmao-tech,[Razão Social] LTDA,XX.XXX.XXX/0001-XX,active,001,YYYY-MM-DD,YYYY-MM-DD,YYYY-MM-DD+1ano,modelo-c,YYYY-MM-DD,never,"primeiro parceiro; família"
  ```
- [ ] Append em `licensing-archive/partners/irmao-tech/pat-log.csv`:
  ```csv
  date,action,pat_type,scope,expires_at,token_suffix_sha256,issued_by,revoked_at,notes
  YYYY-MM-DD,issued,PAT-DEV,"tnf-ecosystem:Contents:Read+Packages:Read",YYYY-MM-DD+180d,<sha256 dos últimos 4 chars>,thiago,,"onboarding inicial"
  YYYY-MM-DD,issued,PAT-CI,"tnf-ecosystem:Contents:Read+Packages:Read",YYYY-MM-DD+180d,<sha256>,thiago,,"CI do irmão"
  ```
- [ ] Commit: `feat(partners): onboard irmao-tech — annex A #001`.

### 5.5 Confirmação

- [ ] E-mail formal ao irmão confirmando onboarding + canais de contato + SLA de rotação.
- [ ] Arquivar e-mail em `partners/irmao-tech/correspondence/YYYY-MM-DD-onboarding.md`.

---

## 🔴 FASE 6 — INPI (paralelo, URGENTE — 2-6 meses elapsed)

**Pode iniciar imediatamente, sem esperar Fases 0-5.** Marcas seguem "first-to-file".

### 6.1 Domínio defensivo BR (15 min, R$ 40)

- [ ] Registrar `bythiagofigueiredo.com.br` no Registro.br (~R$ 40/ano). Apontar mesmo destino do `.com` OU parking page simples.

### 6.2 Marcas (urgência máxima — "first-to-file")

- [ ] **Pesquisa anterioridade** no e-INPI: procurar "Figueiredo Technology" + variações fonéticas/gráficas em classes 9 e 42. Se livre, partir pro depósito.
- [ ] Obter certificado digital ICP-Brasil A3 (cartão ou token) se ainda não tem — necessário pra e-INPI. Alternativa: serviço de certificação online tipo Certisign (~R$ 180/ano).
- [ ] **Depositar "FIGUEIREDO TECHNOLOGY" nominativa, classes 9+42** via e-INPI:
  - Acessar portal e-INPI com certificado.
  - Preencher GRU (R$ 415/classe × 2 = R$ 830 — ou R$ 355/classe se ME confirmada).
  - Pagar GRU (bancário).
  - Especificação produtos/serviços (baseado NCL 12ª edição).
  - Aguardar publicação na RPI (~30 dias).
- [ ] **Depositar "TN FIGUEIREDO" nominativa, classes 9+42** — considerar agente boutique (Peduti, ~R$ 1.500-3.000 honorários) por conta da ambiguidade fonética com "TN" de outras marcas.
- [ ] (Mês 6 opcional) **Depositar "BYTHIAGOFIGUEIREDO" nominativa, classes 9+42+41** (R$ 1.245 — R$ 415 × 3 classes).
- [ ] (Mês 12-24, após concessão) **Pagar taxa decenal** de cada marca: R$ 745/classe (normal) ou R$ 375 (ME).

### 6.3 Copyright registration (probatório)

**Antes de depositar copyright, a cessão PF→PJ precisa existir.** O depósito é feito pela Figueiredo Technology LTDA como titular; Thiago Figueiredo é autor nominado.

- [ ] Executar cessão PF→PJ: preencher `licensing/templates/cession-template.md`, assinar (tu + representante PJ = tu mesmo) + 2 testemunhas. Idealmente via alteração contratual integralizando capital.
- [ ] Arquivar cessão em `licensing-archive/compliance/cession-PF-PJ-YYYY-MM-DD.pdf`.

Depois, para cada um dos 5 packages top-value:

**Top 5 — prioridade alta:**

- [ ] Copyright **@tn-figueiredo/cms** (~R$ 180):
  1. `cd packages/cms && find . -type f ! -path './node_modules/*' ! -path './dist/*' -exec sha512sum {} \; | sort | sha512sum > package.sha512.txt`
  2. Empacotar source em ZIP (excluir node_modules/dist/.git).
  3. Gerar resumo digital (nome, autor, data, linguagem, hash, commit Git hash do `tnf-ecosystem`).
  4. e-Software INPI (com certificado ICP-Brasil).
  5. Pagar GRU R$ 180.
  6. Anexar ZIP + cessão + resumo.
  7. Aguardar certificado em 30-60 dias.

- [ ] Copyright **@tn-figueiredo/admin** (~R$ 180, mesmo fluxo).
- [ ] Copyright **@tn-figueiredo/lgpd** (~R$ 180).
- [ ] Copyright **@tn-figueiredo/auth-nextjs** (~R$ 180).
- [ ] Copyright **@tn-figueiredo/email** (~R$ 180).

**Total copyrights top-5:** ~R$ 900.

### 6.4 Monitoramento pós-concessão (ongoing)

- [ ] Inscrever alertas **RPI (Revista da Propriedade Industrial)** pra "Figueiredo Technology" + variações.
- [ ] Configurar **Google Alerts**:
  - `"Figueiredo Technology"` (com aspas)
  - `"@tn-figueiredo"`
  - `"TN Figueiredo" software`
- [ ] Agendar GitHub trademark scan mensal (search manual ou script): buscar "Figueiredo Technology" + variações em repos públicos.

---

## 🟢 MONITORAMENTO CONTÍNUO (pós-Fase 5)

- [ ] **Quarterly healthcheck** (Runbook 06) todo trimestre — 15 min.
- [ ] **PAT rotation** (Runbook 02) a cada 180 dias.
- [ ] **Audit right** opcional — Runbook 04 — 1×/ano nos primeiros 2 anos com irmão.
- [ ] **LICENSE revisão** — advogado revisa anualmente (~R$ 1.500).

---

## 🔵 BACKLOG — Seção 7 do spec (Portal self-service)

**Quando ativar:** ≥1 parceiro pagante no radar OU ≥2-3 meses de operação formal com irmão.

Sub-sprints (~38h pro MVP Free tier):
- [ ] S-Lic-1: Landing `/licensing` + form CNPJ + BrasilAPI validation (8h)
- [ ] S-Lic-2: Schema DB Supabase + click-wrap Free tier (10h)
- [ ] S-Lic-3: GitHub API invite/PAT automation (12h)
- [ ] S-Lic-4: Dashboard parceiro + revogação self-service (8h)

Sub-sprints do Pro tier (+26h, quando houver demanda):
- [ ] S-Lic-5: Clicksign API + Stripe billing (20h)
- [ ] S-Lic-6: Observability + LGPD + metrics (6h)

**Pré-requisitos não-técnicos:**
- [ ] Advogado aprova **LICENSE-Lite v1** (variação reduzida pra Free tier, cláusula penal R$ 10-20k).
- [ ] ≥1 parceiro pagante negociando Pro tier (pra justificar billing build).

---

## 💰 Orçamento consolidado (ano 1)

| Categoria | Baseline mínimo viável | Completo |
|-----------|------------------------|----------|
| Aliases e-mail (Cloudflare/Zoho) | R$ 0 | R$ 0 |
| Advogado PI (review + ajustes) | R$ 800 | R$ 1.500 |
| Domínio `bythiagofigueiredo.com.br` | R$ 40 | R$ 40 |
| Defensivos adicionais | R$ 0 | R$ 175 |
| Certificado ICP-Brasil A3 | R$ 180 | R$ 180 |
| Clicksign (assinatura) | R$ 50-100 | R$ 500 |
| Backblaze B2 (backup) | R$ 0 (tier free 10GB) | R$ 60 |
| Marca "Figueiredo Technology" 9+42 | R$ 830 | R$ 830 |
| Marca "TN Figueiredo" 9+42 | R$ 0 (defer) | R$ 830 + R$ 2k agente |
| Marca "BYTHIAGOFIGUEIREDO" 9+42+41 | R$ 0 (defer) | R$ 1.245 |
| Copyright INPI top-5 (5 × R$ 180) | R$ 540 (top 3) | R$ 900 |
| Taxa decenal (ano 12+) | R$ 0 (ano 1) | R$ 0 (ano 1) |
| **Total ano 1** | **~R$ 2.440** | **~R$ 8.260** |

Ano 2-10: só renovações de domínio (R$ 40-175/ano) + Clicksign + revisão anual LICENSE (R$ 1.500) = ~R$ 1.700-1.800/ano.

---

## 📋 Critério de conclusão total

Considera-se **projeto de licenciamento completo** quando:

### Fase legal formalizada
- [ ] LICENSE v1.3 aprovada pelo advogado em todos os 32 packages.
- [ ] Master + Anexo A #001 com irmão assinados via Clicksign.
- [ ] NDAs de todos os colaboradores do irmão arquivados.
- [ ] Cessão PF→PJ executada (preferencialmente via integralização de capital).

### Infra operacional
- [ ] Repo `TN-Figueiredo/licensing-archive` privado com 2FA + backup semanal B2.
- [ ] CI guardrail em `bythiagofigueiredo` + `tnf-ecosystem` sem `continue-on-error`.
- [ ] Pre-commit hook ativo.
- [ ] `registry.csv` com 1 linha ativa (irmão).

### Proteção IP
- [ ] Marca "Figueiredo Technology" classes 9+42 depositada (protocolo RPI emitido).
- [ ] Copyright INPI dos top-3 packages registrado (cms, admin, lgpd).
- [ ] Domínio `bythiagofigueiredo.com.br` defensivo registrado.
- [ ] Alertas RPI + Google Alerts ativos.

### Versões publicadas com LICENSE nova
- [ ] `cms@0.3.0` + `email@0.2.0` publicados no GitHub Packages com LICENSE proprietária.
- [ ] Versões MIT antigas deprecadas com nota `npm deprecate`.
- [ ] `apps/web` pinado nas novas versões.

---

## 🔁 Revisão deste documento

Atualizar este `NEXT-STEPS.md` marcando `[x]` conforme completa. Commitar mudanças. Quando **todos os critérios de conclusão total** estiverem ✅, mover o arquivo pra `licensing/DONE.md` como histórico.

Última atualização: 2026-04-16 (criação inicial).
