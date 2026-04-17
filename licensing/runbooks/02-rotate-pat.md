# Runbook 02 — Rotação de PAT (180 dias)

**Quando usar:** PATs (DEV + CI) de um parceiro chegando a 15 dias do expiry, OU rotação voluntária antecipada (boas práticas, compromisso declarado, etc).

**Gatilho:** Lembrete automático 15 dias antes de `expires_at` em `partners/<slug>/pat-log.csv`. Pode ser setado via calendar event ou consultado no Runbook 06 (healthcheck).

**SLA:** Novo PAT entregue ao parceiro em até 48h do envio. PAT antigo revogado 48h após confirmação de adoção (ou imediatamente no expiry, o que vier primeiro).

**Executor:** Figueiredo Tech.

**Referências:** LICENSE Art. 6 (Entrega e Acesso), Runbook 01 (emissão inicial), Runbook 03 (revogação).

---

## Dia D-15 — Aviso de rotação

- [ ] Consultar `licensing/partners/<slug>/pat-log.csv` → localizar PATs com `expires_at` entre D+15 e D+20.
- [ ] Enviar e-mail ao parceiro:
  - Assunto: `[Figueiredo Tech] Rotação programada de PATs — <slug> — vence em 15 dias`
  - Conteúdo: data do expiry, data prevista para envio do novo PAT (D-2 ou D-3), confirmar que contato técnico permanece o mesmo.
  - Anexar checklist do lado do parceiro: atualizar `.npmrc` local + atualizar GitHub Secret `NPM_TOKEN` + revalidar `npm install` em um job de CI.
- [ ] Arquivar em `licensing/partners/<slug>/correspondence/YYYY-MM-DD-rotation-notice.eml`.

## Dia D-3 a D-2 — Gerar novo PAT

- [ ] GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → Generate new token.
- [ ] Mesmas permissions da emissão anterior (ver Runbook 01 Passo 4): `Contents:Read-only` + `Packages:Read-only` + `Metadata:Read-only`, resource `TN-Figueiredo/tnf-ecosystem`, expiry 180d.
- [ ] Nome: `partner-<slug>-dev-YYYY-MM-DD` (novo) / `partner-<slug>-ci-YYYY-MM-DD` (novo).
- [ ] Capturar últimos 8 chars → `shasum -a 256` → registrar `token_suffix_sha256`.

```bash
echo -n "<ultimos_8_chars_do_novo_token>" | shasum -a 256
```

- [ ] Append em `pat-log.csv`:
  ```csv
  2026-10-10,rotate-issue,dev,"Contents:read,Packages:read",2027-04-08,<sha256_novo>,thiago,,"rotation of <token_suffix_sha256_antigo>"
  ```

## Dia D-2 — Entrega ao parceiro

- [ ] Enviar novos PATs via canal seguro (Bitwarden Send / 1Password item / PGP).
- [ ] **Nunca** reenviar no mesmo e-mail do aviso original.
- [ ] Confirmar recebimento com parceiro (reply explícito).
- [ ] Combinar janela de troca: parceiro atualiza `.npmrc` + GitHub Secret; roda CI de validação; confirma sucesso por e-mail.

## Dia D-1 a D — Revogação do PAT antigo

- [ ] Após confirmação de adoção pelo parceiro (CI verde no repo dele), navegar: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → localizar PAT antigo → `Revoke`.
- [ ] Efeito em `npm install` do parceiro: ≤5 minutos (GitHub invalida token imediatamente, cache de CDN pode levar poucos minutos).
- [ ] Se parceiro não respondeu até D-0 (dia do expiry): não prorrogar. PAT expira naturalmente. Se interromper parceiro, Runbook 03 (suporte emergencial — reemissão manual).
- [ ] Append em `pat-log.csv`:
  ```csv
  2026-10-13,revoke,dev,"Contents:read,Packages:read",2026-10-13,<sha256_antigo>,thiago,2026-10-13,"revoked after successful rotation"
  ```

## Pós-rotação — Atualizar registry

- [ ] Atualizar `licensing/registry.csv`: campo `next_pat_rotation` para `<nova_data> - 15d`.
- [ ] Marcar evento no calendário pessoal do Thiago (D+165 = próximo gatilho D-15).

---

## Automação futura (backlog Sprint N+1)

Este fluxo manual é aceitável com 1-5 parceiros. A partir de ~10 parceiros, migrar para:

- **GitHub Action scheduled (cron 0 9 * * *)** em `TN-Figueiredo/tnf-ecosystem-ops` (repo privado de licenciante):
  - Parse `pat-log.csv` de cada parceiro em `partners/*/pat-log.csv`.
  - Detectar `expires_at - now() <= 15d` AND `revoked_at IS NULL`.
  - Emitir issue `[ROTATION-DUE] <slug> expira em Xd` em `tnf-ecosystem-ops/issues`.
  - Fase 2: usar GitHub App com permissão de `administration:write` para gerar PAT automaticamente e injetar em cofre (Vault/1Password CLI) — exige avaliação de segurança antes.

Referência de escopo: `docs/superpowers/specs/2026-04-16-ecosystem-licensing-design.md` Seção 4.4.

---

**Conclusão:** Parceiro nunca sofre interrupção se seguir janela D-2. `pat-log.csv` tem trilha auditável. Próxima rotação em 180d.
