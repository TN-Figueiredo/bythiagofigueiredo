# licensing/ — Artefatos de Licenciamento do Ecossistema `@tn-figueiredo/*`

> ⚠️ **DRAFT — pending Fase 0 advogado review. Não usar em prod.**
>
> Este diretório contém **rascunhos** de contratos, licenças, runbooks e scripts. Nenhum artefato aqui deve ser executado, assinado ou publicado antes da revisão jurídica da Fase 0 do plano de implementação.

## Propósito

Staging area dos artefatos de licenciamento proprietário do ecossistema `@tn-figueiredo/*` antes da migração para o repositório privado separado `TN-Figueiredo/licensing-archive` (Fase 4 do plano).

O conteúdo aqui cobre:

- Licença proprietária customizada (substitui SPDX `UNLICENSED`).
- Contratos (Master Agreement + Anexos por parceiro).
- Runbooks operacionais (emissão de autorização, rotação de PAT, auditoria, offboarding).
- Scripts de automação do ciclo de vida da licença.
- Registry de parceiros autorizados + histórico de compliance.

**Titular:** Figueiredo Technology LTDA, CNPJ 44.243.373/0001-69.

**Versão do diretório:** 1.0 (DRAFT).

## Estrutura

```
licensing/
├── README.md                  ← este arquivo
├── registry.csv               ← registro de parceiros ativos (header-only até Fase 1)
├── templates/                 ← templates de licença e contratos (Stream A)
│   ├── LICENSE-v1.txt         ← licença proprietária customizada
│   ├── master-agreement.md    ← contrato-quadro titular ↔ licenciado
│   ├── annex-parceiro.md      ← modelo de anexo por parceiro
│   └── annex-irmao.md         ← anexo específico intragrupo (cláusula penal calibrada)
├── runbooks/                  ← procedimentos operacionais (Stream B)
│   ├── 01-issue-authorization.md
│   ├── 02-rotate-pat.md
│   ├── 03-audit-partner.md
│   └── 04-offboard-partner.md
├── scripts/                   ← automações (Stream C)
│   ├── rollout-license.sh
│   ├── verify-spdx.sh
│   └── generate-authorization.ts
├── partners/                  ← dossiê por parceiro (um subdir por slug)
├── compliance/                ← artefatos de compliance (LGPD, due diligence)
└── audit/                     ← logs de auditoria + relatórios periódicos
```

Spec completa: [../docs/superpowers/specs/2026-04-16-ecosystem-licensing-design.md](../docs/superpowers/specs/2026-04-16-ecosystem-licensing-design.md)

## Checklist Fase 0 — Pré-requisitos (obrigatórios antes de qualquer rollout)

- [ ] Registrar domínio `figueiredotech.com.br` (Registro.br) para e-mails institucionais.
- [ ] Advogado de Propriedade Intelectual revisa `templates/LICENSE-v1.txt` e `templates/master-agreement.md`.
- [ ] Preencher placeholders de endereço da Figueiredo Technology LTDA em todos os templates (`{{ENDERECO_TITULAR}}`).
- [ ] Preencher placeholders de e-mails institucionais (`legal@`, `security@`, `licensing@figueiredotech.com.br`).
- [ ] Calibrar cláusula penal do Anexo A (intragrupo — irmão) com valor simbólico acordado em família.
- [ ] Validar jurisdição e foro (Foro SP/Brasil) com advogado.
- [ ] Revisar compatibilidade LGPD do fluxo de auditoria com DPO (ou decisão formal de DPO exemption via Resolução CD/ANPD 2/2022).
- [ ] Criar repo privado `TN-Figueiredo/licensing-archive` com acesso restrito (só titular + advogado).

## ⚠️ Avisos Críticos

> ⚠️ **NÃO rodar `scripts/rollout-license.sh` ou `npm publish` de novas versões até advogado aprovar `templates/LICENSE-v1.txt`.**
>
> Publicar pacote com licença não revisada = exposição legal. Todo pacote do ecossistema continua com `license: "UNLICENSED"` até a aprovação formal registrada em `audit/legal-approval-YYYY-MM-DD.md`.

> ⚠️ **Não commitar PATs, tokens de acesso ou chaves em `partners/` ou `audit/`.** Placeholders apenas. Credenciais reais ficam em 1Password/keychain e são referenciadas por handle.

> ⚠️ **`registry.csv` não é fonte de verdade legal.** É um índice operacional. O contrato assinado em `partners/<slug>/annex-signed.pdf` (armazenado no repo privado pós-Fase 4) é o documento vinculante.

## Glossary (quick-ref)

- **SPDX identifier** — string padronizada (`spdx.org/licenses`) que identifica a licença de um pacote no `package.json`. Ecossistema atual usa `UNLICENSED` (equivalente a "todos direitos reservados, sem licença pública"). Migração planejada: `LicenseRef-Figueiredo-Proprietary-v1` apontando para `LICENSE-v1.txt`.
- **Titular** — Figueiredo Technology LTDA (CNPJ 44.243.373/0001-69). Detentor dos direitos patrimoniais e morais sobre `@tn-figueiredo/*`.
- **Licenciado** — pessoa jurídica que firmou Master Agreement + Anexo com o Titular e recebeu autorização formal para usar pacotes do ecossistema em escopo definido.
- **Usuário Autorizado** — pessoa física vinculada ao Licenciado (sócio, empregado, prestador) nomeada no Anexo como operador técnico dos pacotes licenciados. Acesso via PAT pessoal rotacionado conforme runbook `02-rotate-pat.md`.

## Como contribuir (durante Sprint de implementação)

- Streams A/B/C escrevem em `templates/`, `runbooks/`, `scripts/` respectivamente.
- Stream D (este README + scaffolding) não toca nos outros diretórios.
- Integração final e revisão de consistência: tarefa pós-streams, antes do advogado.
- Commit messages seguem convenção do monorepo: `feat: `, `docs: `, `chore: `.

## Próximos passos pós-Fase 0

1. Aprovação jurídica registrada → remover banner DRAFT deste README.
2. Flip de `UNLICENSED` para `LicenseRef-Figueiredo-Proprietary-v1` em `package.json` de cada pacote `@tn-figueiredo/*`.
3. Migração do diretório para `TN-Figueiredo/licensing-archive` (repo privado).
4. Emissão da primeira autorização de uso (intragrupo — irmão) como piloto end-to-end.
