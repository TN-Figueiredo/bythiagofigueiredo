# Runbook 03 — Revogação de Acesso

**Quando usar:** Qualquer situação em que um parceiro, Usuário Autorizado, ou PAT precise perder acesso aos packages `@tn-figueiredo/*`.

**Três fluxos distintos:**

- **Fluxo A — Revogação total do parceiro** (término contratual / breach / motivo de cancelamento / não-pagamento).
- **Fluxo B — Remoção de Usuário Autorizado específico** (saída de funcionário do parceiro; demais usuários continuam).
- **Fluxo C — Suspeita de comprometimento de PAT** (token vazado, suspeita de uso não autorizado; parceiro permanece ativo).

**Executor:** Figueiredo Tech.

**Referências:** LICENSE Art. 7 (Rescisão), Art. 7.5 (Declaração de destruição), Master Agreement Cláusula 10 (Rescisão), Runbook 01 (emissão), Runbook 02 (rotação), `licensing/templates/termination-notice.md`.

---

## Fluxo A — Revogação total do parceiro

### Minuto 0 — Contenção imediata

- [ ] Revogar todos PATs do parceiro no GitHub:
  - Caminho: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → filtrar por `partner-<slug>-*` → Revoke** em cada um.
  - Efeito: `npm install` com token parceiro falha em ≤5 min.
- [ ] Remover outside collaborators:
  - Caminho: **Repo `TN-Figueiredo/tnf-ecosystem` → Settings → Collaborators & teams → Outside collaborators → localizar cada Usuário do parceiro → Remove**.
- [ ] Se o parceiro tem GitHub Action consumindo packages: o CI dele passará a falhar. Esse é o resultado esperado.
- [ ] Append em `pat-log.csv` uma linha `revoke` para cada PAT:
  ```csv
  2026-04-16,revoke,dev,"Contents:read,Packages:read",<expiry_original>,<sha256>,thiago,2026-04-16,"termination Fluxo A — motivo: <breach|non-payment|MdC>"
  ```

### Dia 0 a Dia 1 — Notificação formal

- [ ] Copiar `licensing/templates/termination-notice.md` → `licensing/partners/<slug>/termination-notice-YYYY-MM-DD.md`.
- [ ] Preencher: motivo da rescisão (invocar cláusula específica do Master — Cláusula 10.1/10.2/10.3 conforme o caso); data efetiva; prazos (10d para declaração de destruição; 30d para pagamento de valores pendentes se aplicável).
- [ ] Enviar via Clicksign para assinatura unilateral do licenciante + cópia ao parceiro (CC signatários declarados no Master).
- [ ] Arquivar: `licensing/partners/<slug>/correspondence/YYYY-MM-DD-termination-notice.eml` + PDF assinado em `licensing/partners/<slug>/signed/`.

### Dia 10 — Declaração de destruição

- [ ] Cobrar do parceiro a declaração prevista em LICENSE Art. 7.5: atestado assinado pelo representante legal de que todo material licenciado (incluindo forks, caches, artefatos de build, imagens Docker com layers) foi destruído.
- [ ] Template da declaração: `licensing/templates/destruction-declaration.md` (parceiro preenche + assina via Clicksign).
- [ ] Arquivar: `licensing/partners/<slug>/signed/destruction-declaration-YYYY-MM-DD.pdf`.
- [ ] Se parceiro não entregar declaração em 10d: acionar Runbook 05 (Incident Response) — tratamento como potencial violação pós-rescisão.

### Dia 10+ — Arquivamento final

- [ ] Atualizar `licensing/registry.csv` → status do parceiro = `terminated` + `terminated_at = YYYY-MM-DD`.
- [ ] Mover diretório: `mv licensing/partners/<slug>/ licensing/partners/_archived/<slug>-terminated-YYYY-MM-DD/`.
- [ ] Adicionar README curto em `_archived/<slug>-terminated-YYYY-MM-DD/README.md` com sumário do caso (motivo, datas-chave, pendências).
- [ ] Retenção: diretório arquivado fica ≥10 anos (LGPD ROPA — base legal Art. 7 VI, exercício regular de direitos).

## Fluxo B — Remoção de Usuário Autorizado específico

Use quando o parceiro permanece ativo mas um CPF específico sai (funcionário demitido, troca de time, encerramento de projeto).

- [ ] Parceiro solicita formalmente a remoção + indica substitutos (se houver).
- [ ] Emitir **novo Anexo A substitutivo** (Runbook 01 Passo 2) omitindo o Usuário removido — o Anexo A é substituível, não cumulativo.
- [ ] Colher assinatura Clicksign em D+0 a D+2.
- [ ] Se o Usuário tinha username GitHub como outside collaborator: GitHub → Repo `TN-Figueiredo/tnf-ecosystem` → Settings → Collaborators → Remove.
- [ ] **Não** revogar PATs do parceiro — PAT é da PJ, não do Usuário individual.
- [ ] Anexo A antigo é superseded; manter arquivado em `licensing/partners/<slug>/anexos/` mas marcar como `superseded-YYYY-MM-DD` no nome.
- [ ] Atualizar `licensing/partners/<slug>/users.md`.

## Fluxo C — Suspeita de comprometimento de PAT

Gatilho: GitHub Secret vazou em log público, parceiro reporta suspeita, monitoramento detectou uso anômalo, etc.

- [ ] **Minuto 0:** Revogar PAT comprometido (GitHub → Fine-grained tokens → Revoke).
- [ ] Emitir substituto imediato (Runbook 01 Passo 4) — mesmo scope, expiry 180d a partir da data de reemissão.
- [ ] Entregar substituto ao parceiro via canal seguro (Bitwarden Send / 1Password item).
- [ ] Append `pat-log.csv` com `action=revoke-compromised` + `notes` detalhando origem da suspeita.
- [ ] Se o comprometimento expôs bytes de código (repo clonado por terceiro não autorizado): escalar ao Runbook 05 (Incident Response).
- [ ] Rotina de autópsia: documentar como o token vazou + recomendação ao parceiro (SCA, secret scanning, rotação automática em CI).

---

**Conclusão:** Cada fluxo tem gatilho e efeito claros. Fluxo A é irreversível do lado do licenciante; Fluxos B e C mantêm o parceiro operando. Todas as ações têm trilha em `pat-log.csv` + `correspondence/`.
