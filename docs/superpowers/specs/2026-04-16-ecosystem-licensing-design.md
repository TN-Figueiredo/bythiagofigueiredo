# Ecosystem Licensing — LICENSE + Contratos + Operações (Design)

**Date:** 2026-04-16
**Status:** Design approved via 7-section iterative brainstorm. Scores per section after recursive self-critique: S1 98, S2 98 (v1.2 after 2 iterações), S3 98, S4 98, S5 98, S6 98, S7 96 (deliberadamente não-exaustiva — backlog).
**Target:** formalizar juridicamente e operacionalmente os 32 packages `@tn-figueiredo/*` sob regime proprietário B2B, com trilha técnica (fine-grained PATs) + contrato master + roadmap INPI.
**Pre-conditions:** Figueiredo Technology LTDA (CNPJ 44.243.373/0001-69) é o titular dos direitos. Packages já publicados no GitHub Packages sob conta pessoal `TN-Figueiredo`; monorepo `tnf-ecosystem`. Sprint 4a+4b concluídos.

---

## Motivation

Hoje (2026-04-16) o ecossistema `@tn-figueiredo/*` tem 32 packages publicados mas:
- **2 com LICENSE MIT** (cms, email) — permitem uso comercial livre por terceiros, irrevogável pra versões já publicadas.
- **30 sem LICENSE nem `license` field no package.json** — juridicamente "all rights reserved" por default, mas sem texto explícito = proteção frágil em disputa.
- **Zero contratos** com o único parceiro ativo (o irmão do titular, PJ separada com colaboradores).
- **Zero registros INPI** — marcas "Figueiredo Technology" e "@tn-figueiredo" vulneráveis a "first-to-file" por terceiros.
- **Zero processo operacional** documentado pra emitir/revogar autorizações, conduzir auditoria, arquivar evidências.

A motivação primária é **proteger contra colaboradores de parceiros** (risco real): hoje um colaborador do irmão pode baixar qualquer package via credencial do irmão e usar em projeto pessoal, sem qualquer barreira legal ou técnica.

Este design formaliza proteção em **3 camadas**: propriedade intelectual (INPI), contratual (LICENSE + Master + NDAs), e técnica (fine-grained PATs revogáveis). B2B-only (exclui pessoa física consumidora/CDC). Extração do monorepo em 32 repos individuais é descartada explicitamente.

---

## Goals

- **LICENSE proprietária v1** (SPDX `LicenseRef-Proprietary-FigueiredoTech-v1`) idêntica nos 32 packages.
- **Master Agreement** PJ↔PJ reutilizável entre Figueiredo Technology LTDA e cada parceiro, referenciando LICENSE v1 com Anexo A (autorização específica) + Anexo C (NDA flow-down).
- **Processo operacional** executável solo em 6 runbooks (emissão, rotação de PAT, revogação, auditoria, incident response, healthcheck trimestral).
- **Repo privado `licensing-archive`** separado do `tnf-ecosystem`, com templates + runbooks + registry.csv + backup semanal encriptado pra Backblaze/Wasabi.
- **CI guardrails** bloqueando regressão (LICENSE file + license field + `files` array + SHA-256 match).
- **Migração das versões MIT legadas**: bump `cms@0.3.0` + `email@0.2.0` com LICENSE nova; versões anteriores permanecem MIT irrevogáveis + `npm deprecate` com nota.
- **Primeiro parceiro formalizado** (irmão): Master + Anexo A #001 + NDAs dos colaboradores, PATs emitidos, collaborator access configurado.
- **Roadmap INPI**: depósito de marcas "Figueiredo Technology" + "TN Figueiredo" (classes 9 + 42) + copyright dos 5 packages top-value.
- **Portal self-service B2B** (backlog) em `bythiagofigueiredo.com/licensing` — design preliminar em 3 tiers (Free/Pro/Enterprise) pra automação futura.

## Non-goals

- **Extração do monorepo em 32 repos individuais** — inviável solo. Granular per-package access não se resolve por ACL do GitHub (nenhum tier) e seria premature optimization com 1 parceiro de alta confiança.
- **Migração imediata pra GitHub Team org paga** — é feature do crescimento da equipe, não da segurança contra parceiros. Vira sprint futuro quando houver ≥2 devs ou revenue pagando US$ 4-40/mês sem dor.
- **Revogação da MIT nas versões `cms@0.2.0` + `email@0.1.0`** — MIT é irrevogável pra versões já publicadas. Foco é forward-looking: versões futuras carregam LICENSE nova.
- **LICENSE dual-license tipo BUSL** — conflita com intenção "apenas o titular pode usar livremente". BUSL tem change date que auto-converte pra permissiva; descartada.
- **Licença pra pessoa física consumidor** — B2B-only. Exclusão explícita de CDC no Artigo 11.4 da LICENSE.
- **Patentes** — software não-patenteável no BR (LPI Art. 10, V). Descartado.
- **Build do portal self-service agora** — só design preliminar (Seção 7). Construção é backlog ~38h (tier Free) a ser priorizado após Seções 1-6 estabilizadas e ≥1 parceiro real na mão.
- **Madrid Protocol (registro internacional)** — não-necessário BR-focused. Backlog.

---

## Architecture

### 3 camadas de proteção

**Camada 1 — Propriedade Intelectual (ativa):**
- Registro INPI de marcas "Figueiredo Technology" + "TN Figueiredo" (classes 9 software + 42 serviços TI), com alertas RPI pós-concessão.
- Registro INPI de copyright dos 5 packages top-value (`cms`, `admin`, `lgpd`, `auth-nextjs`, `email`) — hash SHA-512 do código-fonte + referência a commit Git imutável.
- Domínios defensivos: `bythiagofigueiredo.com` (já titular); adicionar `bythiagofigueiredo.com.br` + typo variants (ver seção Roadmap INPI → Domínios defensivos).
- Declaração de segredo de negócio (Lei 9.279/96 Art. 195) em LICENSE e README de cada package.

**Camada 2 — Jurídica contratual:**
- LICENSE v1 proprietária (SPDX `LicenseRef-Proprietary-FigueiredoTech-v1`) idêntica nos 32 packages.
- Master Agreement PJ↔PJ assinado uma vez por parceiro; referencia LICENSE + Anexos.
- Anexo A (autorização específica) substituível sem renegociar Master — detalha packages + versões + projetos + Usuários Autorizados + prazo + valor comercial.
- Anexo C (NDA flow-down) — parceiro obriga-se a celebrar com cada colaborador.
- Cláusula penal: 10× Licença Comercial Equivalente anual OU R$ 50k (o maior); multa diária R$ 500/dia até teto R$ 100k. Perdas e danos cumulativos (Art. 416 §único CC).
- Jurisdição: Foro SP/Brasil; arbitragem CAM-CCBC opcional por Anexo A específico.
- Idioma autêntico: PT-BR.

**Camada 3 — Técnica (deterrente):**
- Fine-grained PAT per-parceiro escopado ao repo `tnf-ecosystem`; 2 PATs (PAT-DEV + PAT-CI) pra minimizar blast radius.
- Rotação obrigatória a cada 180 dias; revogação instant via GitHub UI.
- Audit log GitHub exportado mensalmente pra `licensing-archive`.
- Provenance signing via sigstore no publish (forense pós-incidente).
- Outside collaborators no repo `tnf-ecosystem` (read-only) — revogável em segundos.

### Repo architecture

**`TN-Figueiredo/tnf-ecosystem`** (existente, monorepo com 32 packages):
- Recebe LICENSE v1 em cada `packages/*/` via rollout script.
- Recebe `scripts/check-license.sh` como guardrail CI + pre-commit.
- Recebe `licensing-templates/LICENSE-v1.txt` sincronizado com archive (hash match validado no CI).

**`TN-Figueiredo/licensing-archive`** (novo, privado, 0 collaborators):
```
licensing-archive/
├── README.md
├── registry.csv                        # Master index: partners + status
├── partners/<partner-slug>/
│   ├── master-agreement-signed.pdf
│   ├── annexes/
│   │   ├── 001-YYYY-MM-DD.pdf
│   │   └── 001-YYYY-MM-DD-SUPERSEDED.pdf
│   ├── ndas/<user-cpf-last-4>-YYYY-MM-DD.pdf
│   ├── correspondence/YYYY-MM-DD-<topic>.md
│   ├── pat-log.csv
│   ├── billing/invoices/
│   └── audit/YYYY-audit-report.pdf
├── templates/
│   ├── LICENSE-v1.txt
│   ├── master-agreement.md
│   ├── annex-a.md
│   ├── nda-flowdown.md
│   ├── authorization-request.md
│   └── termination-notice.md
├── runbooks/
│   ├── 01-issue-authorization.md
│   ├── 02-rotate-pat.md
│   ├── 03-revoke-access.md
│   ├── 04-conduct-audit.md
│   ├── 05-incident-response.md
│   └── 06-quarterly-healthcheck.md
├── compliance/ropa-licensing.md         # LGPD ROPA
└── .github/workflows/backup.yml         # Weekly encrypted backup to B2
```

Backup semanal GPG-encrypted pra Backblaze B2 (retenção 10 anos — 5 comercial + 5 sobrevivência confidencialidade). Passphrase em 1Password + cópia física offline.

---

## LICENSE v1.2 — estrutura em 21 artigos

**Nota de versionamento:** SPDX identifier `LicenseRef-Proprietary-FigueiredoTech-v1` é estável pro major cycle inteiro. Revisões minor (v1.1, v1.2, v1.3 pós-advogado, etc.) não mudam o SPDX — são metadados internos no rodapé do próprio arquivo LICENSE e no CHANGELOG do `licensing-archive`. Apenas mudanças materiais que exijam aviso de 90d aos licenciados (LICENSE Art. 18.6) justificariam bump pra v2 (novo SPDX `-v2`).

Texto autoritativo PT-BR com header SPDX EN pra tooling. Principais artigos:

1. **Definições** — Software, Titular, Licenciado, Autorização, Projeto, Usuário Autorizado, Informação Confidencial, Violação Material com/sem Cura, Mudança de Controle, Licença Comercial Equivalente, Partes.
2. **Titularidade** — copyright (Lei 9.610/98) + segredo de negócio (Lei 9.279/96 Art. 195). Não transfere marca (carve-out explícito).
3. **Aceite** — assinatura OU instalação DELIBERADA pós-ciência OU uso, o primeiro que ocorrer.
4. **Concessão limitada** — não-exclusiva, intransferível, não-sublicenciável, revogável; só nos Projetos e por Usuários Autorizados; dependências OSS carve-out.
5. **Usuários Autorizados e NDA** — flow-down obrigatório; Licenciado responde solidária e ilimitadamente por atos de Usuários e terceiros via suas credenciais, salvo violação criminal externa não-prevenível; subcontratação com notificação prévia.
6. **Condutas proibidas** — redistribuição, uso fora de escopo, reverse engineering, remoção de notice, treinamento de IA, forks, bypass de controles técnicos, benchmarks comerciais, uso ilegal.
7. **Término** — Violação Material com Cura (30d) vs sem Cura (imediato); por conveniência (90d aviso titular / 30d licenciado); efeitos + declaração de destruição em 10d.
8. **Confidencialidade** — cuidado equivalente ao dos próprios segredos; sobrevivência 5 anos; notificação de violação em 48h.
9. **Penalidades e tutela de urgência** — cláusula penal R$ 50k mínimo / 10× Licença Comercial Equivalente; multa diária R$ 500 (cap R$ 100k); perdas e danos cumuláveis; juros 1% a.m. + multa 2% + IPCA; tutela reconhecida como dano irreparável; execução específica (CPC Art. 497); atualização anual IPCA.
10. **Auditoria** — 1×/ano com 10 dias úteis aviso; auditor externo assina NDA; custos do titular salvo violação material.
11. **Garantias e limitação** — COMO ESTÁ; responsabilidade cap R$ 10k ou 12-meses pagos; exclusão de danos indiretos; exclusão de CDC (B2B-only).
12. **Indenização** — bilateral; titular até R$ 100k contra IP infringement claims (com exclusões); licenciado sem cap contra mau uso.
13. **Cessão e sucessão** — não-cedível sem consentimento; Mudança de Controle = cessão; vincula sucessores do titular.
14. **LGPD** — titular não é controlador/operador do processamento via uso do software; para dados de Usuários Autorizados titular é controlador com base legal Art. 7 V + IX; incidentes notificados em 48h.
15. **Disclosure de vulnerabilidades** — `security@bythiagofigueiredo.com`; 72h ciência → titular; 90d disclosure responsável.
16. **Notificações** — carta AR / e-mail com confirmação / cartório títulos.
17. **Força maior** — Art. 393 CC; notificação 5 dias úteis; mitigação razoável.
18. **Disposições gerais** — autonomia (sem vínculo empregatício/societário), tributos por conta do licenciado, anti-renúncia, autonomia das cláusulas, integralidade, modificação com 90d aviso.
19. **Idioma autêntico** — PT-BR.
20. **Legislação e foro** — Leis 9.610/98 + 9.279/96 + 13.709/18 + 10.406/02 + 13.105/15; Foro SP; opção CAM-CCBC.
21. **Contato** — `licensing@`, `security@`, `juridico@` no domínio existente `bythiagofigueiredo.com` (configurar aliases via Cloudflare Email Routing ou Zoho Mail).

Texto completo da LICENSE v1.2 é entregue como `licensing-archive/templates/LICENSE-v1.txt` após aprovação de advogado de PI (Fase 0).

---

## Master Agreement template — estrutura em 16 cláusulas

PJ↔PJ, pessoas civilmente capazes, representação legal com poderes suficientes. 16 cláusulas:

1. **Objeto** — framework sob o qual Anexos A específicos são emitidos.
2. **LICENSE aplicável** — v1 como Anexo B, prevalecendo este Acordo em caso de conflito apenas pro signatário.
3. **Concessão e escopo** — mediante Anexo A vigente; atualização por Anexo A substitutivo numerado.
4. **Condições comerciais** — Modelo A (gratuito com reciprocidade), B (comercial R$/ano), C (híbrido — recomendado pra parceria familiar/fundadora ano 1 gratuito → renegocia ano 2).
5. **NDA flow-down** — conforme Anexo C; Licenciado responde solidária e ilimitadamente.
6. **Confidencialidade** — referencia LICENSE Arts. 8 e 14.
7. **Prazo e término** — indeterminado; conveniência 90d; efeitos conforme LICENSE 7.5.
8. **Responsabilidade, penalidades e indenização** — referencia LICENSE Arts. 9, 11, 12.
9. **Auditoria** — referencia LICENSE Art. 10.
10. **LGPD** — referencia LICENSE Art. 14; ROPA próprio do Licenciado; incidentes 48h.
11. **Cessão, sucessão e MdC** — referencia LICENSE Art. 13; notificação 30d antes de negociação vinculante (LOI/Term Sheet).
12. **Representações e garantias** — capacidade, não-conflito, representação, ausência de litígio material.
13. **Força maior** — referencia LICENSE Art. 17.
14. **Notificações** — endereços eletrônicos registrados.
15. **Disposições gerais** — autonomia, tributos, anti-renúncia, integralidade, assinatura eletrônica (MP 2.200-2/2001 + Lei 14.063/2020 — ICP-Brasil / Gov.br / Clicksign / D4Sign), idioma.
16. **Legislação e foro** — Foro SP; arbitragem CAM-CCBC opcional por Anexo A específico.

### Anexo A — Autorização de Uso (substituível)

Seções: (1) Pacotes e versões, (2) Projetos autorizados, (3) Usuários Autorizados (nome + CPF + e-mail + função + início), (4) Restrições específicas, (5) Condições comerciais (Modelo), (6) Controle técnico (PAT-DEV + PAT-CI, rotação 180d, atualização em 48h pelo licenciado), (7) Assinaturas.

### Anexo C — NDA Flow-Down (1 página)

Assinado por cada Usuário Autorizado; obrigações mínimas: (1) confidencialidade, (2) uso restrito aos Projetos, (3) anti-redistribuição, (4) anti-reverse engineering, (5) anti-AI-training, (6) notificação de violação em 48h, (7) destruição em 10d pós-desligamento, (8) cooperação com auditoria. Sobrevivência 5 anos; responsabilidade pessoal direta + solidariedade da PJ.

---

## Processo operacional — 6 runbooks

### Runbook 01 — Issue Authorization (SLA 3 dias úteis)

1. Validar solicitação (CNPJ ativo via Receita Federal; projetos consistentes; CPFs válidos; parceiro é PJ).
2. Preencher templates (Master se novo; Anexo A sempre).
3. Assinatura eletrônica via Clicksign/D4Sign (~R$ 5-10/doc).
4. Emitir 2 PATs (DEV + CI) fine-grained, 180d expiry, scope repo `tnf-ecosystem` + `Contents:read` + `Packages:read`.
5. Adicionar outside collaborators ao repo (read-only).
6. Arquivar evidências em `partners/<slug>/`; append `pat-log.csv` com `date,action,pat_type,scope,expires_at,token_suffix_sha256,issued_by,revoked_at,notes` (colunas obrigatórias); atualizar `registry.csv`.
7. Notificação formal ao parceiro (e-mail arquivado em `correspondence/`).

### Runbook 02 — Rotate PAT (180d)

15 dias antes do expiry: gerar novo PAT → enviar com 48h de antecedência → parceiro atualiza → revogar antigo → append log. Automação futura via GitHub Action (Sprint N+1).

### Runbook 03 — Revoke Access

Triggers: término, breach, MdC, saída de usuário, suspeita de comprometimento.
- Imediato: revogar PAT (≤5 min efeito em `npm install`) + remover collaborator.
- Notificação formal via Clicksign (`termination-notice.md`).
- Declaração de destruição em 10d (LICENSE 7.5).
- Mover `partners/<slug>/` → `partners/_archived/<slug>-terminated-YYYY-MM-DD/`; registry status=`terminated`.

### Runbook 04 — Conduct Audit (anual opt-in)

Aviso 10 dias úteis → escopo definido → auditor externo assina NDA → coleta evidências (logs, lista de Usuários, amostra de código) → relatório → se violação material: Runbook 05 + custos ao licenciado + cláusula penal.

### Runbook 05 — Incident Response

Containment ≤1h → triagem ≤24h → notificações ≤48h (parceiro sempre; ANPD se LGPD; advogado se material) → investigação preservando chain of custody → remediação → post-mortem arquivado.

### Runbook 06 — Quarterly Healthcheck (15 min)

Checklist: registry atualizado; PATs próximos de expiry; NDAs de novos colaboradores arquivados; backup executou; security log exportado; correspondência arquivada; avisos de 90d pendentes.

### LGPD Compliance

ROPA em `licensing-archive/compliance/ropa-licensing.md` declarando: finalidade execução de contrato + accountability; base legal Art. 7 V + IX; categorias (nome, CPF, e-mail profissional de Usuários); retenção 10 anos; medidas (repo privado GitHub + 2FA + backup encrypted).

### Orçamento anual

| Item | Custo |
|------|-------|
| Clicksign/D4Sign | R$ 500 |
| Backup B2/Wasabi | R$ 60 |
| Advogado revisão anual | R$ 1.500 |
| Advogado ad-hoc (reserva) | R$ 2.000 |
| **Total provisão** | **R$ 4.060** |

---

## Migration Plan — 6 fases

### Fase 0 — Pre-work legal (~2-3 dias, maioria espera)
- **P0.1** Configurar aliases `licensing@`, `security@`, `juridico@`, `privacidade@` no domínio existente `bythiagofigueiredo.com` (Cloudflare Email Routing free OU Zoho free). Sem registro de domínio novo — usar o domínio principal já titulado pela PJ.
- **P0.2** Advogado PI revisa LICENSE v1.2 + Master + Anexos (~R$ 800-1.500, 1.5-3h review + 1 rodada ajustes). Candidatos: Baptista Luz, Peduti, ou conhecido.
- **P0.3** Preencher placeholders: endereço CNPJ (Junta Comercial SP); calibrar cláusula penal vs porte do parceiro.

### Fase 1 — LICENSE rollout em 32 packages (~4h)
- **P1.1** LICENSE final em `licensing-archive/templates/LICENSE-v1.txt`.
- **P1.2** Script `scripts/rollout-license.sh` (skip `private:true`): copia LICENSE + atualiza `package.json` (`license: LicenseRef-Proprietary-FigueiredoTech-v1` + `files` inclui `LICENSE`) + injeta header SPDX em READMEs.
- **P1.3** Review `git diff` — 32 packages alterados.
- **P1.4** `npm run typecheck && npm test` — não quebra nada.
- **P1.5** Commit único: `chore(license): apply proprietary LICENSE v1 to all 32 packages`.
- **P1.6** PR + review advogado + merge.

### Fase 2 — CI guardrails (~2h)
- **P2.1** `scripts/check-license.sh` valida por package: LICENSE file existe + `license` field correto + `files` inclui `LICENSE` + SHA-256 match com template canônico; skip `private:true`.
- **P2.2** Adicionar step ao `.github/workflows/ci.yml`.
- **P2.3** Adicionar ao pre-commit hook (husky/lefthook).
- **P2.4** Testar regressão: remover LICENSE local → pre-commit bloqueia.

### Fase 3 — Legacy MIT bump (~2h)
- **P3.1** `packages/cms`: `0.2.0 → 0.3.0` (minor bump pro sinalizar LICENSE change; package é pre-1.0).
- **P3.2** `packages/email`: `0.1.0 → 0.2.0`.
- **P3.3** CHANGELOG entry: "🚨 BREAKING: LICENSE CHANGED — previously MIT, now `LicenseRef-Proprietary-FigueiredoTech-v1`. Versions ≤ 0.2.x (cms) / ≤ 0.1.x (email) remain MIT."
- **P3.4** README banner visível.
- **P3.5** `npm publish` ambos.
- **P3.6** `npm deprecate '@tn-figueiredo/cms@0.2.0'` + `'@tn-figueiredo/email@0.1.0'` com nota.
- **P3.7** `npm install @tn-figueiredo/cms@0.3.0 @tn-figueiredo/email@0.2.0 --workspace=apps/web --save-exact`; rodar `npm test && npm run build`.
- **P3.8** E-mail direto ao irmão (único outro consumer conhecido) com nova LICENSE + Anexo A #001.

### Fase 4 — Archive repo bootstrap (~3h)
- **P4.1** Criar `TN-Figueiredo/licensing-archive` privado, 0 collaborators.
- **P4.2** Estrutura completa + templates + runbooks + `ropa-licensing.md`.
- **P4.3** Runbooks = redação final da Architecture (runbooks) deste spec.
- **P4.4** 2FA obrigatório na conta GitHub.
- **P4.5** Backup workflow GPG+B2 semanal; passphrase em 1Password + cópia física offline; retention lifecycle 10 anos.

### Fase 5 — First partner (irmão) (~1 sem elapsed, ~4h ativo)
- **P5.1** Enviar drafts: Master + Anexo A #001 + NDA template.
- **P5.2** Discutir Modelo comercial (recomendo C: gratuito ano 1, renegocia ano 2).
- **P5.3** Ajustes + PDFs finais.
- **P5.4** Assinatura Clicksign: Master + Anexo A + 2 testemunhas.
- **P5.5** Irmão coleta NDAs dos colaboradores; envia cópias.
- **P5.6** Emitir PATs (Runbook 01 passo 4).
- **P5.7** Adicionar outside collaborators em `tnf-ecosystem` (read-only).
- **P5.8** Arquivar tudo em `partners/irmao-tech/`; `registry.csv` linha 1.
- **P5.9** E-mail de confirmação + onboarding completo.

### Fase 6 — INPI filing (paralelo a Fases 0-5, 2-6 meses elapsed)
**Independência:** Fase 6 não depende de Fases 1-5. Pode iniciar na Semana 1 (domínio + pesquisa anterioridade + primeiro depósito) simultânea ao pre-work legal da Fase 0. Crítico: o depósito da marca "Figueiredo Technology" é o item mais urgente de toda a migração (risco "first-to-file"), ainda mais urgente que LICENSE rollout. Ver "Roadmap INPI" abaixo.

### Rollback plans

| Fase | Falha | Rollback |
|------|-------|----------|
| P1 | Script quebra package.json | `git reset --hard HEAD~1`; refazer manualmente |
| P2 | CI falha em PR não-relacionado | Desativar step + `gh pr merge --admin`; corrigir script |
| P3 | `npm publish` falha (versão existe) | Bump patch adicional; sem `unpublish` após 72h |
| P3 | apps/web quebra pós-upgrade | Pin em 0.2.x (MIT) temporário; corrigir incompat em 0.3.1 |
| P5 | Irmão recusa termos | Revisar cláusulas (tipicamente penal ou MdC); iterar |

### Critério de conclusão
- [ ] 32 packages com LICENSE + `license` field + `files` array corretos.
- [ ] CI + pre-commit bloqueiam regressão.
- [ ] `cms@0.3.0` + `email@0.2.0` publicados com LICENSE nova.
- [ ] `licensing-archive` criado; backup funcional.
- [ ] Irmão: Master + Anexo A #001 + NDAs dos colaboradores assinados/arquivados.
- [ ] PATs emitidos; outside collaborator access concedido; apps/web funciona.
- [ ] `registry.csv` com 1 linha ativa.

---

## Roadmap INPI

### Marcas (prioridade alta — "first to file")

| Marca | Tipo | Classes NCL 12 | Urgência | Custo depósito |
|-------|------|----------------|----------|----------------|
| FIGUEIREDO TECHNOLOGY | Nominativa | 9 + 42 | 🔴 Imediata | R$ 830 |
| TN FIGUEIREDO | Nominativa | 9 + 42 | 🟠 Alta | R$ 830 |
| BYTHIAGOFIGUEIREDO | Nominativa | 9 + 42 + 41 | 🟡 Média | R$ 1.065 |
| Logomarca | Figurativa/mista | 9 + 42 | 🟢 Baixa (quando existir) | R$ 830 |

Taxa INPI: R$ 415/classe (PJ normal) ou R$ 355 (ME/MEI — confirmar enquadramento Figueiredo Technology). Concessão no 10º ano: R$ 745/classe (normal) ou R$ 375 (ME/MEI), renovável.

**Processo:**
1. Pesquisa anterioridade no INPI (gratuita).
2. Depósito e-INPI com certificado ICP-Brasil; GRU + especificação produtos/serviços + apresentação marca.
3. Publicação RPI (~30d) + prazo oposição 60d.
4. Exame mérito 12-18 meses.
5. Concessão + taxa decenal.
6. Efeitos retroagem à data do depósito (LPI 129 §1º).

**DIY vs Agente:** DIY pra "Figueiredo Technology" (simples, R$ 2.320 total); agente boutique pra "TN Figueiredo" (ambiguidade com trademark "TN" de outras empresas, R$ 2.320 + honorários R$ 1.500-3.500).

### Copyright registration (probatório, não-constitutivo)

Top-5 packages pela estratégia valor-primeiro:

| Package | Urgência | Custo |
|---------|----------|-------|
| `@tn-figueiredo/cms` | 🔴 Imediata | R$ 180 |
| `@tn-figueiredo/admin` | 🔴 Imediata | R$ 180 |
| `@tn-figueiredo/lgpd` | 🟠 Alta | R$ 180 |
| `@tn-figueiredo/auth-nextjs` | 🟡 Média | R$ 180 |
| `@tn-figueiredo/email` | 🟢 Baixa | R$ 180 |

**Processo:**
1. Gerar SHA-512 do source (excluir `node_modules/` + `dist/` + `.git/`).
2. ZIP do source.
3. Resumo digital (nome, autor, data, linguagem, hash, commit Git hash).
4. e-Software INPI com certificado ICP-Brasil; titular PJ; autor pessoa física declarado; cessão total anexada.
5. GRU R$ 180.
6. Certificado 30-60 dias.

**Cessão pessoa física → PJ** (pré-requisito do registro): contrato de cessão Thiago Figueiredo → Figueiredo Technology LTDA, preferencialmente por integralização de capital social (evita IR e ISS). Alinhar com contador. Direitos morais inalienáveis permanecem com pessoa física (Lei 9.610/98 Art. 27).

### Domínios defensivos

Domínio principal **já titular: `bythiagofigueiredo.com`**. Não se registra novo domínio — usa-se o existente pra branding, site e aliases institucionais (`licensing@`, `security@`, `juridico@`).

Defensivos adicionais opcionais:

| Domínio | Prioridade | R$/ano |
|---------|------------|--------|
| `bythiagofigueiredo.com.br` | 🟠 Alta (defensive BR) | 40 |
| `bythiagofigueiredo.net` | 🟡 Média (typo defense) | 70 |
| `tn-figueiredo.com.br` | 🟡 Média (brand alt) | 40 |
| `tn-figueiredo.com` | 🟡 Média (brand alt global) | 65 |
| `figueiredotech.com.br` | 🟢 Baixa (só se marca "Figueiredo Technology" for depositada no INPI) | 40 |

Total baseline ano 1: R$ 40 (só `.com.br` do domínio principal). Defensivos adicionais conforme evolução: R$ 215 se pegar tudo.

### Monitoramento pós-concessão

- Alertas RPI (gratuito): inscrever "Figueiredo Technology" + variações; oposição 60d a depósitos similares.
- Google Alerts: "Figueiredo Technology" + "@tn-figueiredo".
- GitHub trademark scan mensal.
- Serviços pagos (Smartleges) overkill pro stage.

Ação em violação: (a) C&D letter via advogado; (b) takedown DMCA GitHub/npm; (c) judicial em último caso.

### Timeline + custo

```
Semana 1:   Domínios + pesquisa anterioridade        (R$ 105)
Semana 2-3: Depósito "Figueiredo Technology" 9+42 +   (R$ 1.190)
            cessão PF→PJ + copyright cms + admin
Semana 4-6: Depósito "TN Figueiredo" 9+42 +           (R$ 1.010)
            copyright lgpd
Mês 3-4:    Copyright auth-nextjs + email             (R$ 360)
Mês 6:      "BYTHIAGOFIGUEIREDO" (opcional)            (R$ 1.065)
Mês 12-24:  Concessão marcas + taxas decenais          (R$ 745-1.490/marca)
```

**Total ano 1 — baseline viável:** ~R$ 1.475 (1 marca + 3 copyrights + domínios mínimos).
**Total ano 1 — completo:** ~R$ 6.380 (3 marcas + 5 copyrights + todos domínios + advogado).

### Madrid Protocol (backlog)

Depósito único INPI válido em ~100 países. US$ 1.500-3.000. Só quando expansão internacional justificar.

---

## Portal self-service B2B (backlog — Seção 7)

Backlog ~38h pro MVP Free tier. Design preliminar:

### 3 tiers

| Tier | Self-service | Max packages | Max users | Revenue cap | LICENSE | Contrato | Preço |
|------|--------------|--------------|-----------|-------------|---------|----------|-------|
| **Free** | 100% | ≤ 3 | ≤ 5 | ≤ R$ 500k/ano (self-cert) | v1-Lite (penal R$ 10-20k) | Click-wrap | R$ 0 |
| **Pro** | 100% | ≤ 10 | ≤ 20 | ≤ R$ 5M/ano | v1 | Click-wrap + Clicksign Widget | R$ 200-2k/mês |
| **Enterprise** | Manual | Ilimitado | Ilimitado | > R$ 5M | v1 + custom | Master assinado offline | Negociado |

### Stack

- Frontend: `/licensing` em `apps/web` (Next 15 + Tailwind 4).
- Backend: server actions + API routes Next.
- DB: Supabase (`partners`, `partner_agreements`, `partner_authorizations`, `partner_pats`).
- Integrações: BrasilAPI (CNPJ validation grátis), Clicksign API (assinatura), GitHub REST API (invite + PAT), Stripe/Pagar.me (billing Pro), Brevo (e-mails).

### Schema preliminar

```sql
create table partners (
  id uuid primary key default gen_random_uuid(),
  cnpj text unique not null,
  razao_social text not null,
  tier text check (tier in ('free','pro','enterprise')),
  status text check (status in ('pending','active','suspended','terminated')),
  representative_name text,
  representative_cpf text,
  representative_email text not null,
  onboarded_at timestamptz,
  created_at timestamptz default now()
);
create table partner_agreements (
  id uuid primary key,
  partner_id uuid references partners(id) on delete cascade,
  agreement_type text,        -- license_v1, master, annex_a
  version text,
  clicksign_envelope_id text,
  signed_at timestamptz,
  document_url text,
  document_sha256 text
);
create table partner_authorizations (
  id uuid primary key,
  partner_id uuid references partners(id) on delete cascade,
  packages jsonb,              -- [{name, version_range}]
  projects jsonb,
  authorized_users jsonb,
  valid_from date,
  valid_until date,
  revoked_at timestamptz
);
create table partner_pats (
  id uuid primary key,
  partner_id uuid references partners(id) on delete cascade,
  pat_type text check (pat_type in ('dev','ci')),
  github_token_fingerprint text,
  issued_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);
```

### Flow Free tier MVP

1. `/licensing` landing → 3 tiers.
2. "Start Free" → form CNPJ.
3. BrasilAPI valida + auto-preenche.
4. Seleção packages (≤3) + Projetos.
5. LICENSE full-screen + scroll forçado + **checkbox separado pra Artigo 9 (penalidades)** — requisito click-wrap BR anti-surpresa.
6. Nome digitado do representante + IP + timestamp capturados.
7. Server action cria `partners` + `agreements` + `authorizations`.
8. GitHub API: invite collaborator + PAT emitidos.
9. PAT por e-mail cifrado (age/GPG MVP) OU dashboard logado (V2).
10. Dashboard `/licensing/dashboard` status + histórico + rotação PAT + renovação.

### Validade jurídica click-wrap BR

MP 2.200-2/2001 + Lei 14.063/2020 + STJ REsp 1.495.920/DF + TJSP AC 1030472 precedentes validam click-wrap B2B com scroll forçado + checkbox destacado. Cláusula penal alta requer destaque específico (daí checkbox separado Art. 9) pra resistir a "onerosidade excessiva".

### Roadmap implementação (sprint separado)

| Sprint | Entrega | Esforço |
|--------|---------|---------|
| S-Lic-1 | Landing + form + BrasilAPI | 8h |
| S-Lic-2 | Schema DB + click-wrap Free | 10h |
| S-Lic-3 | GitHub API invite/PAT automation | 12h |
| S-Lic-4 | Dashboard + revogação | 8h |
| S-Lic-5 | Pro tier + Clicksign + Stripe | 20h |
| S-Lic-6 | Observability + LGPD + metrics | 6h |

Free tier MVP: ~38h (1 sprint). Pro tier: +26h.

Pré-requisitos: Seções 1-6 implementadas; 2-3 meses de aprendizado formal com irmão; advogado aprova LICENSE-Lite; ≥1 parceiro pagante no radar pra justificar Pro.

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Terceiro registra "Figueiredo Technology" no INPI antes | Depósito imediato na Fase 6 semana 1-2; anterioridade de uso documentada como defesa subsidiária |
| Irmão rejeita cláusula penal R$ 50k (desproporcional a porte dele) | Calibrar no Anexo A #001 específico; reduzir pra R$ 20k pra parceiro familiar; manter R$ 50k como default pro Anexo de futuros parceiros |
| Colaborador do irmão vaza package via PAT do irmão | Flow-down NDA + responsabilidade solidária ilimitada do irmão + audit log GitHub forense; cláusula penal acionável contra irmão que aciona internamente contra colaborador |
| LICENSE v1 tem bug jurídico (cláusula nula/ineficaz) | Fase 0 review por advogado PI; autonomia das cláusulas (Art. 18.4) preserva restante; versão v1.3 pós-review antes de deploy |
| MIT legado em cms@0.2.0 reusado por terceiros desconhecidos | Aceito — `npm deprecate` sinaliza mudança; volume de install dessas versões é zero fora do teu controle (verificar `npm view` stats pré-migração) |
| GitHub fine-grained PAT policy não aceita org repos | N/A — conta pessoal não tem a exigência; se migrar pra org paga futuro, habilitar Settings → PAT → Allow fine-grained |
| Backup passphrase perdida = archive irrecuperável | 1Password + cópia física offline (cofre/gaveta trancada) + GitHub Secrets apenas pro workflow automatizado |
| Parceiro contesta assinatura eletrônica em juízo | Clicksign/D4Sign geram certificado ICP-Brasil + trilha auditoria (IP, timestamp, geolocation); MP 2.200-2/2001 Art. 10 §2º garante validade |
| Cessão PF→PJ contestada por herdeiros futuros | Contrato de cessão antes de qualquer registro INPI; ideal em integralização de capital social documentada na alteração contratual da LTDA |

---

## Open questions

1. **Figueiredo Technology LTDA é ME/MEI (receita ≤ R$ 360k/ano)?** Afeta taxa INPI (R$ 355 vs R$ 415) e copyright. Confirmar com contador.
2. **Endereço cadastrado na Junta Comercial SP** — necessário preencher placeholder no LICENSE/Master antes do deploy.
3. **Advogado de PI escolhido** — Baptista Luz, Peduti, ou alternativa?
4. ~~**Domínio `figueiredotech.com.br` vs uso de subdomínio em `bythiagofigueiredo.com`**~~ — **RESOLVIDO (2026-04-16)**: manter `bythiagofigueiredo.com` como domínio principal; aliases institucionais via Cloudflare Email Routing. Defensivos adicionais (`bythiagofigueiredo.com.br`, `.net`) opcionais; `figueiredotech.com.br` só se marca for depositada no INPI.
5. **Modelo comercial com irmão ano 1** — confirmar Modelo C (gratuito ano 1 → renegocia ano 2).
6. **Cláusula penal calibrada ao irmão** — R$ 20k específico no Anexo A #001, mantendo R$ 50k default pra futuros parceiros?
7. **Logomarca Figueiredo Technology existe?** — afeta prioridade de depósito figurativa.

---

## Future work

- **Portal self-service B2B** (Seção 7) — build quando ≥1 parceiro pagante estiver no radar OU pós-Sprint 8.
- **Monorepo split em repos individuais** — só se múltiplos parceiros com interesses distintos OU licenciamento comercial por package.
- **Migração pra GitHub Team org paga** — quando ≥2 devs internos OU precisar de audit log detalhado.
- **Madrid Protocol (registro marca internacional)** — quando expansão internacional justificar.
- **D&O insurance pra Figueiredo Technology** — pode fazer sentido com revenue >R$ 500k/ano.
- **Escrow de código-fonte** (triggered por óbito/incapacitação) — cartório SP oferece; premature solo hoje.
- **Seguro ciber (Cyber Insurance)** — se volume de parceiros crescer.
- **LICENSE-Lite v1** — variação reduzida pra tier Free do portal self-service.
- **ISO 27001 / SOC 2** — quando vender pra clientes enterprise.

---

## Appendix — Entregáveis deste design

Textos finais a serem produzidos como arquivos em `licensing-archive/templates/` após aprovação:
1. `LICENSE-v1.txt` — 21 artigos PT-BR + header SPDX EN
2. `master-agreement.md` — 16 cláusulas + 3 modelos comerciais (A/B/C)
3. `annex-a.md` — template 7 seções com placeholders
4. `nda-flowdown.md` — Anexo C 1 página
5. `authorization-request.md` — template pro parceiro solicitar
6. `termination-notice.md` — template pro titular terminar
7. `ropa-licensing.md` — ROPA LGPD do processo de licenciamento
8. `runbooks/01-06.md` — 6 runbooks operacionais
9. `cession-template.md` — contrato de cessão PF→PJ
