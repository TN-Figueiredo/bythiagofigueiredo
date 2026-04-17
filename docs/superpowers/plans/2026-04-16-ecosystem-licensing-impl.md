# Ecosystem Licensing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Produzir e commitar todos os artefatos de licenciamento (textos legais PT-BR, runbooks, scripts, scaffolding) como drafts no diretório `licensing/` do monorepo `bythiagofigueiredo`, prontos pra revisão de advogado de PI antes de qualquer deploy em prod.

**Architecture:** 4 workstreams independentes rodando em paralelo via subagents, escrevendo arquivos em subdiretórios sem overlap. Após completar, integração final (CI step + hash verification) + commit consolidado. Staging em `licensing/` pra facilitar migração futura pro repo `TN-Figueiredo/licensing-archive`.

**Tech Stack:** Markdown (textos), Bash (scripts), YAML (GitHub Actions), Node.js (package.json manipulation via scripts). Sem TypeScript/testes automatizados — artefatos são docs e templates, não código executável em runtime.

**Escopo explicitamente EXCLUÍDO do MVP de hoje:**
- Rodar `scripts/rollout-license.sh` nos 32 packages (Fase 1 do spec) — só DEPOIS de advogado aprovar LICENSE v1.2.
- `npm publish` de `cms@0.3.0` / `email@0.2.0` (Fase 3) — bloqueado por mesma razão.
- Criação do repo `TN-Figueiredo/licensing-archive` (Fase 4) — depende de ação manual no GitHub.
- Registro de domínio, advogado, INPI (Fases 0, 6) — ações humanas off-platform.

Ou seja: **hoje produzimos todos os deliverables em draft; deploy é etapa seguinte pós-advogado.**

---

## File Structure

```
licensing/                                       # novo diretório (root)
├── README.md                                    # Stream D
├── registry.csv                                 # Stream D
├── .gitkeep-maps/                               # Stream D (preserva estrutura vazia)
│   ├── partners/.gitkeep
│   ├── compliance/.gitkeep
│   └── audit/.gitkeep
├── templates/                                   # Stream A
│   ├── LICENSE-v1.txt                           # SHA-256 canônico
│   ├── master-agreement.md
│   ├── annex-a.md
│   ├── nda-flowdown.md
│   ├── authorization-request.md
│   ├── termination-notice.md
│   ├── cession-template.md
│   └── ropa-licensing.md
├── runbooks/                                    # Stream B
│   ├── 01-issue-authorization.md
│   ├── 02-rotate-pat.md
│   ├── 03-revoke-access.md
│   ├── 04-conduct-audit.md
│   ├── 05-incident-response.md
│   └── 06-quarterly-healthcheck.md
└── scripts/                                     # Stream C
    ├── rollout-license.sh                       # +x
    ├── check-license.sh                         # +x
    └── backup-workflow.yml                      # pra futura licensing-archive

.github/workflows/ci.yml                         # Integração: +1 step
```

---

## Task 1 — Scaffold `licensing/` root + stubs

**Files:**
- Create: `licensing/.gitkeep`

- [ ] **Step 1:** Criar diretório base via scaffold primeiro agente.

**Owner:** Stream D subagent (bootstrap only).

---

## Stream A — Legal Templates (PT-BR authoritative)

### Task 2 — `licensing/templates/LICENSE-v1.txt`

**Conteúdo:** Texto completo da LICENSE v1.2 conforme Seção 2 do spec `docs/superpowers/specs/2026-04-16-ecosystem-licensing-design.md` — 21 artigos em PT-BR com header SPDX EN. Incluir patches v1.1 → v1.2 do spec (Artigo 3.1(b) deliberate install, 5.3 solidária/ilimitada, 6.1(h) benchmarks comerciais, 7.5 a partir de quando, 10.1 GMT-3, 11.2 evento gerador, 12.2(e) versão obsoleta, 20.3 CAM-CCBC).

**Placeholders deliberados no texto** (preencher em Fase 0):
- `[endereço cadastrado na Junta Comercial]`
- Data: `2026-04-16`
- E-mails: `licensing@bythiagofigueiredo.com`, `security@...`, `juridico@...`

**Critério:** arquivo `.txt` (não `.md`) porque SPDX-License-Identifier convenção + ferramentas `npm`/`license-check` reconhecem melhor.

---

### Task 3 — `licensing/templates/master-agreement.md`

**Conteúdo:** Master Agreement conforme Seção 3 do spec — 16 cláusulas + 3 modelos comerciais (A gratuito, B comercial, C híbrido). Incluir patch v1.1 do spec (Cláusula 11.2 LOI/Term Sheet em vez de "negociação materializada").

**Placeholders:** dados Licenciado (Razão Social, CNPJ, endereço, representante), data, valor do Modelo B se aplicável.

---

### Task 4 — `licensing/templates/annex-a.md`

**Conteúdo:** Anexo A conforme Seção 3 — 7 seções (Pacotes, Projetos, Usuários, Restrições, Comercial, Controle técnico, Assinaturas). Incluir patch do spec (Seção 6 PAT 48h update).

**Placeholders:** dados do parceiro + Anexo número sequencial.

---

### Task 5 — `licensing/templates/nda-flowdown.md`

**Conteúdo:** NDA flow-down conforme Anexo C da Seção 3 — 8 itens incluindo patch (item 8 cooperação com auditoria).

---

### Task 6 — `licensing/templates/authorization-request.md`

**Conteúdo:** Template pro parceiro preencher solicitando autorização. Deve coletar: CNPJ, Razão Social, representante legal, packages desejados, projetos (nome + domínio + finalidade), Usuários previstos (nome + CPF + e-mail + função), Modelo comercial preferido (A/B/C), prazo desejado. Formato: lista de preenchimento simples em markdown.

---

### Task 7 — `licensing/templates/termination-notice.md`

**Conteúdo:** Template de notificação formal de término. Slots: motivo (conveniência/breach/MdC), data efetiva, itens que licenciado deve devolver/destruir, prazo de 10d pra declaração de destruição, referência à LICENSE Art. 7.5, aviso de sobrevivências (confidencialidade 5a, penalidades, audit 2a).

---

### Task 8 — `licensing/templates/cession-template.md`

**Conteúdo:** Contrato de cessão de direitos autorais pessoa física → Figueiredo Technology LTDA conforme Seção 6.3 do spec. Template contém: dados cedente (Thiago Figueiredo + CPF), dados cessionária (Figueiredo Technology LTDA + CNPJ 44.243.373/0001-69), objeto (lista de packages `@tn-figueiredo/*`), cessão total e definitiva + direitos morais inalienáveis (Art. 27 Lei 9.610/98), natureza (gratuita/integralização de capital social/onerosa), foro SP, assinaturas.

---

### Task 9 — `licensing/templates/ropa-licensing.md`

**Conteúdo:** ROPA (Registro de Operações) LGPD pro processo de licenciamento. Seções: finalidade (execução de Acordo Master + accountability); base legal (LGPD Art. 7, V — execução de contrato + IX — legítimo interesse); categorias de titulares (representantes legais de parceiros + Usuários Autorizados); categorias de dados (nome, CPF, e-mail profissional); compartilhamento (nenhum — uso interno Figueiredo Technology); transferência internacional (nenhuma); retenção (10 anos — 5 comercial + 5 sobrevivência); medidas de segurança (repo privado GitHub, 2FA obrigatório, backup encriptado B2/Wasabi, rotação de PATs); DPO (dispensado por Resolução CD/ANPD 2/2022 — small-business exemption).

---

## Stream B — Runbooks (PT-BR)

### Task 10 — `licensing/runbooks/01-issue-authorization.md`

**Conteúdo:** Runbook conforme Seção 4.3 do spec — 7 passos (validar solicitação → preencher templates → assinatura Clicksign → emitir 2 PATs → adicionar collaborators → arquivar → notificação formal). SLA 3 dias úteis. Incluir colunas obrigatórias do pat-log.csv (patch v1.1 do spec).

---

### Task 11 — `licensing/runbooks/02-rotate-pat.md`

**Conteúdo:** Seção 4.4 — gatilho 15d antes de expiry, fluxo de rotação em 48h, automação futura via GitHub Action.

---

### Task 12 — `licensing/runbooks/03-revoke-access.md`

**Conteúdo:** Seção 4.5 — 3 fluxos (revogação total do parceiro, remoção de Usuário apenas, comprometimento de PAT). Incluir comandos GitHub específicos.

---

### Task 13 — `licensing/runbooks/04-conduct-audit.md`

**Conteúdo:** Seção 4.6 — aviso formal 10d, definição de escopo, auditor externo com NDA próprio (LICENSE Art. 10.2), coleta de evidências, relatório. Incluir template de e-mail de audit-notice.

---

### Task 14 — `licensing/runbooks/05-incident-response.md`

**Conteúdo:** Seção 4.7 — tipos de incidente (violação, vuln, LGPD), fluxo base (containment ≤1h → triagem ≤24h → notificações ≤48h → investigação → remediação → post-mortem). Incluir thresholds específicos pra cada notificação (ANPD se LGPD, advogado se material, parceiro sempre).

---

### Task 15 — `licensing/runbooks/06-quarterly-healthcheck.md`

**Conteúdo:** Seção 4.8 — checklist trimestral 15 min (registry atualizado, PATs expirando, NDAs novos colaboradores, backup, security log, correspondência, avisos 90d).

---

## Stream C — Scripts + CI

### Task 16 — `licensing/scripts/rollout-license.sh`

**Conteúdo:** Script conforme Seção 5.3 P1.2 do spec (patch v1.1 — skip `private: true`). Funcionalidade:
1. Para cada `packages/*/`:
   - Skip se `package.json.private === true`.
   - Copia `licensing/templates/LICENSE-v1.txt` → `packages/<pkg>/LICENSE`.
   - Atualiza `package.json`: `license: 'LicenseRef-Proprietary-FigueiredoTech-v1'` + `files` inclui `LICENSE` (dedupe).
   - Injeta header SPDX no README (se README existe e não tem header).
2. Echo final "Done. Review with git diff before commit."

**Shebang:** `#!/usr/bin/env bash` + `set -euo pipefail`.

**Permissão:** executable (+x).

**Crítico:** NÃO é rodado como parte desta implementação — é staging. Só rodar após advogado aprovar LICENSE-v1.txt.

**Step 1: Criar arquivo com conteúdo completo:**

```bash
#!/usr/bin/env bash
# scripts/rollout-license.sh — Apply proprietary LICENSE v1 to all non-private packages
# DO NOT RUN before advogado approves licensing/templates/LICENSE-v1.txt
set -euo pipefail

LICENSE_SRC="licensing/templates/LICENSE-v1.txt"
PACKAGES_DIR="packages"
LICENSE_REF="LicenseRef-Proprietary-FigueiredoTech-v1"

if [ ! -f "$LICENSE_SRC" ]; then
  echo "ERROR: $LICENSE_SRC not found. Run from repo root."
  exit 1
fi

for pkg_dir in "$PACKAGES_DIR"/*/; do
  pkg_name=$(basename "$pkg_dir")

  # Skip private workspace packages
  is_private=$(node -p "JSON.parse(require('fs').readFileSync('$pkg_dir/package.json','utf8')).private === true" 2>/dev/null || echo false)
  if [ "$is_private" = "true" ]; then
    echo "⏭  Skipping private package: $pkg_name"
    continue
  fi

  echo "🔧 Processing $pkg_name..."

  # Copy LICENSE
  cp "$LICENSE_SRC" "$pkg_dir/LICENSE"

  # Update package.json
  node -e "
    const fs = require('fs');
    const path = '$pkg_dir/package.json';
    const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
    pkg.license = '$LICENSE_REF';
    pkg.files = Array.from(new Set([...(pkg.files || []), 'LICENSE', 'README.md']));
    fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  "

  # Inject SPDX header into README if missing
  readme="$pkg_dir/README.md"
  if [ -f "$readme" ]; then
    if ! grep -q 'SPDX-License-Identifier' "$readme"; then
      header="<!-- SPDX-License-Identifier: $LICENSE_REF -->
> **⚠️ Proprietary Software.** Uso mediante autorização escrita. Ver [LICENSE](./LICENSE).

"
      printf '%s%s' "$header" "$(cat "$readme")" > "$readme.tmp"
      mv "$readme.tmp" "$readme"
    fi
  else
    printf '<!-- SPDX-License-Identifier: %s -->\n> **⚠️ Proprietary Software.**\n\n# %s\n' "$LICENSE_REF" "$pkg_name" > "$readme"
  fi
done

echo "✅ Done. Review with: git diff"
```

**Step 2:** `chmod +x licensing/scripts/rollout-license.sh`

---

### Task 17 — `licensing/scripts/check-license.sh`

**Conteúdo:** Script conforme Seção 5.4 P2.1. Validações por package (não-private):
1. LICENSE file existe.
2. `license` field === `LicenseRef-Proprietary-FigueiredoTech-v1`.
3. `files` array contém `LICENSE`.
4. SHA-256 do `packages/<pkg>/LICENSE` bate com `licensing/templates/LICENSE-v1.txt` canônico.

Exit 1 se qualquer falhar; detalha cada package com problema.

```bash
#!/usr/bin/env bash
# scripts/check-license.sh — CI guard: ensure all non-private packages have correct proprietary LICENSE
set -euo pipefail

REQUIRED_LICENSE="LicenseRef-Proprietary-FigueiredoTech-v1"
LICENSE_CANONICAL="licensing/templates/LICENSE-v1.txt"
EXIT=0

if [ ! -f "$LICENSE_CANONICAL" ]; then
  echo "❌ Canonical LICENSE not found: $LICENSE_CANONICAL"
  exit 1
fi

expected_hash=$(shasum -a 256 "$LICENSE_CANONICAL" | awk '{print $1}')

for pkg_dir in packages/*/; do
  pkg_name=$(basename "$pkg_dir")

  is_private=$(node -p "JSON.parse(require('fs').readFileSync('$pkg_dir/package.json','utf8')).private === true" 2>/dev/null || echo false)
  if [ "$is_private" = "true" ]; then continue; fi

  if [ ! -f "$pkg_dir/LICENSE" ]; then
    echo "❌ $pkg_name: missing LICENSE file"
    EXIT=1
    continue
  fi

  actual_license=$(node -p "JSON.parse(require('fs').readFileSync('$pkg_dir/package.json','utf8')).license" 2>/dev/null)
  if [ "$actual_license" != "$REQUIRED_LICENSE" ]; then
    echo "❌ $pkg_name: license='$actual_license' (expected '$REQUIRED_LICENSE')"
    EXIT=1
  fi

  actual_hash=$(shasum -a 256 "$pkg_dir/LICENSE" | awk '{print $1}')
  if [ "$expected_hash" != "$actual_hash" ]; then
    echo "❌ $pkg_name: LICENSE drift (hash mismatch vs canonical)"
    EXIT=1
  fi

  has_license_in_files=$(node -p "JSON.parse(require('fs').readFileSync('$pkg_dir/package.json','utf8')).files?.includes('LICENSE')" 2>/dev/null)
  if [ "$has_license_in_files" != "true" ]; then
    echo "❌ $pkg_name: package.json 'files' must include 'LICENSE'"
    EXIT=1
  fi
done

if [ $EXIT -eq 0 ]; then
  echo "✅ All non-private packages have correct proprietary LICENSE v1"
fi
exit $EXIT
```

`chmod +x`.

---

### Task 18 — `licensing/scripts/backup-workflow.yml`

**Conteúdo:** GitHub Action workflow pro futuro repo `licensing-archive` fazer backup semanal GPG-encrypted → Backblaze B2. Não roda neste repo — fica staging pra copiar quando o licensing-archive for criado (Fase 4).

```yaml
# .github/workflows/backup.yml — weekly encrypted backup to B2
name: Weekly backup
on:
  schedule:
    - cron: '0 3 * * 0'  # Domingo 03:00 UTC
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install B2 CLI
        run: pip install b2
      - name: Tar + encrypt
        env:
          BACKUP_PASSPHRASE: ${{ secrets.BACKUP_PASSPHRASE }}
        run: |
          TS=$(date -u +%Y-%m-%dT%H-%M-%SZ)
          tar czf "licensing-archive-${TS}.tar.gz" --exclude='.git' --exclude='.github' .
          gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" -c "licensing-archive-${TS}.tar.gz"
          rm "licensing-archive-${TS}.tar.gz"
      - name: Upload to B2
        env:
          B2_APPLICATION_KEY_ID: ${{ secrets.B2_KEY_ID }}
          B2_APPLICATION_KEY: ${{ secrets.B2_APP_KEY }}
          B2_BUCKET: ${{ secrets.B2_BUCKET }}
        run: |
          b2 authorize-account "$B2_APPLICATION_KEY_ID" "$B2_APPLICATION_KEY"
          b2 upload-file "$B2_BUCKET" licensing-archive-*.tar.gz.gpg "backups/$(ls licensing-archive-*.tar.gz.gpg)"
```

---

## Stream D — Archive Scaffolding

### Task 19 — `licensing/README.md`

**Conteúdo:** README explicando propósito do diretório, estado DRAFT, dependência de Fase 0 (advogado), estrutura de subdiretórios, futura migração pro repo `TN-Figueiredo/licensing-archive` separado.

Deve incluir:
- Warning banner de DRAFT.
- Índice dos templates + runbooks + scripts.
- Link pro spec `docs/superpowers/specs/2026-04-16-ecosystem-licensing-design.md`.
- Checklist de Fase 0 (registrar domínio, advogado review, preencher placeholders).
- Instruções de NÃO rodar `scripts/rollout-license.sh` sem aprovação jurídica.

---

### Task 20 — `licensing/registry.csv`

**Conteúdo:** Apenas header das colunas conforme Seção 4.2 do spec:
```csv
partner_slug,razao_social,cnpj,status,active_annex,annex_date,start_date,renewal_date,commercial_model,last_pat_rotation,last_audit,notes
```

Nenhuma linha de dados (ainda).

---

### Task 21 — Stubs de diretório vazios

**Files to create:**
- `licensing/partners/.gitkeep`
- `licensing/compliance/.gitkeep`
- `licensing/audit/.gitkeep`

Conteúdo: vazio. Preserva estrutura no git.

---

## Integration Tasks (sequential, após todas streams)

### Task 22 — Validar consistência hash LICENSE

- [ ] **Step 1:** Executar `shasum -a 256 licensing/templates/LICENSE-v1.txt` e anotar.
- [ ] **Step 2:** Confirmar que `check-license.sh` referencia `licensing/templates/LICENSE-v1.txt` (não hardcoded hash).

Risco mitigado: texto canônico e hash são lidos dinamicamente; sem drift entre script e arquivo.

---

### Task 23 — Adicionar step ao CI existente

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1:** Após o step `Check @tn-figueiredo/* packages are pinned` existente, adicionar:

```yaml
- name: Check proprietary LICENSE integrity
  run: bash licensing/scripts/check-license.sh
```

**Nota crítica:** este CI step **vai falhar** até a Fase 1 ser executada (packages ainda sem LICENSE). Opções:
- (A) **Commit agora mas com `continue-on-error: true`** — step roda mas não bloqueia PR até Fase 1 completar.
- (B) **Deixar o step commentado** — só ativa quando Fase 1 roda.

Recomendação: **(A)** — CI mostra warning, vira error quando Fase 1 roda + desativa `continue-on-error` no mesmo PR.

- [ ] **Step 2:** Aplicar opção A com `continue-on-error: true` inicial + comment `# TODO: remove continue-on-error after Fase 1 rollout`.

---

### Task 24 — Commit consolidado

- [ ] **Step 1:** `git add licensing/ .github/workflows/ci.yml`
- [ ] **Step 2:** Commit:

```
feat(licensing): stage proprietary LICENSE drafts + runbooks + scripts

Produz todos os deliverables jurídicos e operacionais do spec
ecosystem-licensing em estado DRAFT pendente de revisão de advogado
de PI. Inclui:
- LICENSE v1.2 PT-BR autoritativa + 7 templates contratuais
- 6 runbooks operacionais (authorize/rotate/revoke/audit/incident/healthcheck)
- Scripts de rollout (staging only) + CI guardrail + backup workflow
- Scaffolding pra migração futura ao repo TN-Figueiredo/licensing-archive

NÃO executa rollout nos 32 packages — aguarda aprovação jurídica (Fase 0).
CI step adicionado com continue-on-error; vira bloqueante após Fase 1.

Refs: docs/superpowers/specs/2026-04-16-ecosystem-licensing-design.md
```

- [ ] **Step 3:** `git status` confirma worktree clean (exceto `package.json M` preexistente não-relacionado).

---

## Execução via subagents paralelos

4 streams são totalmente independentes (zero file overlap). Dispatch em paralelo:

- **Stream A** → 1 subagent cobre Tasks 2-9 (8 arquivos templates).
- **Stream B** → 1 subagent cobre Tasks 10-15 (6 runbooks).
- **Stream C** → 1 subagent cobre Tasks 16-18 (3 scripts).
- **Stream D** → 1 subagent cobre Tasks 19-21 (README + registry + stubs).

Depois das 4 streams completarem: eu (main agent) executo Tasks 22-24 sequencialmente (consistência + CI + commit).

---

## Self-review

**Spec coverage:** Spec Seções 1-6 cobertas por tasks 2-23; Seção 7 (portal) intencionalmente fora (backlog ~38h próprio sprint).

**Placeholder scan:** Sem TBDs/TODOs. "Placeholders deliberados" em textos legais (endereço, datas, dados do parceiro) são esperados e destacados — preenchidos em Fase 0.

**Type consistency:** Nome LICENSE `LicenseRef-Proprietary-FigueiredoTech-v1` idêntico em todos os scripts, templates, specs. `licensing/templates/LICENSE-v1.txt` referenciado consistentemente.

Ready for parallel execution.
