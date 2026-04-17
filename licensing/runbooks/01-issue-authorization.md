# Runbook 01 — Emitir Autorização de Uso

**Quando usar:** Novo parceiro contrata licença, OU parceiro existente solicita novo Anexo A (adição de projeto, troca de Usuários Autorizados, extensão de escopo).

**SLA:** 3 dias úteis do recebimento da solicitação formal até envio do Anexo A assinado + PATs entregues.

**Executor:** Figueiredo Tech (licenciante) — tnfigueiredotv@gmail.com.

**Referências:** LICENSE Art. 4 (Usuários Autorizados), Master Agreement Cláusula 5 (Entregáveis), Anexo A (template em `licensing/templates/anexo-a-authorization.md`).

---

## Passo 1 — Validar solicitação

- [ ] Solicitação chegou por escrito (e-mail para `licensing@bythiagofigueiredo.com` ou formulário).
- [ ] Validar CNPJ do solicitante via <https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp> (status `ATIVA`; razão social bate com a declarada).
- [ ] Confirmar que solicitante é PJ (CNPJ). Não licenciamos para PF.
- [ ] Validar CPFs dos Usuários Autorizados propostos (DV correto — ferramenta online ou algoritmo).
- [ ] Checar consistência dos projetos declarados (nomes, escopo, domínios de uso previstos).
- [ ] Se partner já existente: confirmar que não há MdC (Motivo de Cancelamento) em aberto nem breach reportado em `partners/<slug>/incidents/`.

**Bloqueio:** Qualquer inconsistência → responder solicitante pedindo correção. Não avançar.

## Passo 2 — Preencher templates

- [ ] Slug do parceiro: kebab-case da razão social abreviada (ex: `acme-tecnologia-ltda` → `acme`).
- [ ] Criar diretório `licensing/partners/<slug>/` se parceiro novo.
- [ ] Se Master Agreement ainda não assinado: copiar `licensing/templates/master-agreement.md` → `licensing/partners/<slug>/master-agreement-draft.md` e preencher placeholders (CNPJ, endereço, signatários, cláusula penal calibrada por porte).
- [ ] Copiar `licensing/templates/anexo-a-authorization.md` → `licensing/partners/<slug>/anexos/anexo-a-YYYY-MM-DD.md`. Preencher: projetos, versões dos packages `@tn-figueiredo/*`, lista de Usuários Autorizados (nome completo + CPF + papel), data de vigência, número sequencial.

## Passo 3 — Assinatura eletrônica

- [ ] Exportar draft para PDF.
- [ ] Enviar via Clicksign (preferencial) ou D4Sign para signatários do parceiro + Thiago Figueiredo como licenciante.
- [ ] Aguardar assinaturas (SLA interno: até 48h; parceiro pode demorar mais — cronometrar no SLA externo).
- [ ] Baixar PDF assinado com trilha de auditoria → salvar em `licensing/partners/<slug>/signed/anexo-a-YYYY-MM-DD.pdf` (e `master-agreement-signed.pdf` se primeiro Anexo).

## Passo 4 — Emitir PATs (DEV + CI)

Fine-grained Personal Access Tokens do GitHub via conta de service account de Figueiredo Tech (não pessoal).

- [ ] Navegar: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
- [ ] **PAT 1 — DEV** (uso local do parceiro):
  - Resource owner: `TN-Figueiredo`
  - Repository access: `Only select repositories` → `TN-Figueiredo/tnf-ecosystem`
  - Permissions: `Contents: Read-only` + `Packages: Read-only` + `Metadata: Read-only`
  - Expiration: 180 dias
  - Nome: `partner-<slug>-dev-YYYY-MM-DD`
- [ ] **PAT 2 — CI** (uso em pipeline do parceiro):
  - Mesmas permissões e expiry; nome `partner-<slug>-ci-YYYY-MM-DD`.
- [ ] Copiar tokens (mostrados UMA vez). Hash SHA-256 dos últimos 8 chars → coluna `token_suffix_sha256`.

```bash
echo -n "<ultimos_8_chars_do_token>" | shasum -a 256
```

## Passo 5 — Outside collaborators (read-only)

- [ ] Para cada Usuário Autorizado que precise de acesso direto ao repo (opcional — PAT já cobre `npm install`): GitHub → `TN-Figueiredo/tnf-ecosystem` → Settings → Collaborators → Add people → username GitHub do Usuário → role `Read`.
- [ ] Registrar username GitHub de cada Usuário em `licensing/partners/<slug>/users.md`.

## Passo 6 — Arquivar evidências + atualizar logs

- [ ] Arquivar em `licensing/partners/<slug>/`:
  - `signed/` — PDFs assinados (Master + Anexo A).
  - `evidence/cnpj-YYYY-MM-DD.pdf` — print do comprovante Receita Federal.
  - `pats/` — NADA aqui exceto metadados. **Nunca** commitar PAT em claro.
- [ ] Append em `licensing/partners/<slug>/pat-log.csv` (criar com header se novo parceiro). Colunas obrigatórias:
  ```csv
  date,action,pat_type,scope,expires_at,token_suffix_sha256,issued_by,revoked_at,notes
  2026-04-16,issue,dev,"Contents:read,Packages:read",2026-10-13,<sha256>,thiago,,"initial issuance"
  2026-04-16,issue,ci,"Contents:read,Packages:read",2026-10-13,<sha256>,thiago,,"initial issuance"
  ```
- [ ] Atualizar `licensing/registry.csv` com linha do parceiro: `slug,razao_social,cnpj,status=active,master_signed_at,last_anexo_a,next_pat_rotation,contact_email`.

## Passo 7 — Notificação formal

- [ ] Enviar e-mail ao parceiro com:
  - PDF do Anexo A assinado (anexo).
  - PATs em canal seguro separado (Bitwarden Send, 1Password item compartilhado, OU e-mail criptografado PGP — **nunca** em claro no mesmo e-mail do contrato).
  - Instrução: PAT DEV → `.npmrc` local; PAT CI → GitHub Secret `NPM_TOKEN` no repo do parceiro.
  - Data de rotação (180d) + referência ao Runbook 02.
- [ ] Arquivar cópia do e-mail em `licensing/partners/<slug>/correspondence/YYYY-MM-DD-authorization-issued.eml`.
- [ ] Marcar SLA como cumprido em `registry.csv`.

---

**Conclusão:** Parceiro pode executar `npm install` com tokens válidos por 180d. Próximo evento: rotação (Runbook 02) 15 dias antes do expiry.
