# Runbook 06 — Healthcheck Trimestral

**Quando usar:** A cada 90 dias (1º dia útil do trimestre: janeiro, abril, julho, outubro). Máximo **15 minutos** de execução se tudo estiver em ordem.

**Objetivo:** Verificação preventiva de integridade do processo de licenciamento — pega problemas pequenos antes de virarem incidentes (Runbook 05) ou SLA miss (Runbooks 01/02).

**Executor:** Thiago Figueiredo, solo.

**Saída:** Um commit em `licensing/healthchecks/YYYY-QN.md` com o checklist preenchido + pendências abertas como tarefas datadas.

**Referências:** Runbook 01 (issue), Runbook 02 (rotate), Runbook 03 (revoke), Runbook 05 (incident), LGPD ROPA (`licensing-archive/compliance/ropa-licensing.md`).

---

## Preparação (1 min)

- [ ] Copiar este template para `licensing/healthchecks/YYYY-QN.md` (ex: `2026-Q2.md`).
- [ ] Data de execução: `YYYY-MM-DD`.
- [ ] Última execução: consultar arquivo do quarter anterior.

## Checklist (12 min)

### 1. Registry atualizado

- [ ] `licensing/registry.csv` tem linha para cada parceiro em `licensing/partners/*/` (excluindo `_archived/`).
- [ ] Status de cada parceiro (`active` / `suspended` / `terminated`) reflete a realidade.
- [ ] Contatos de e-mail testados no último quarter (enviar ping se >6 meses sem contato).

### 2. PATs próximos de expiry

- [ ] Varrer `licensing/partners/*/pat-log.csv` e listar entradas com `expires_at - now() <= 30d` AND `revoked_at IS NULL`:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/licensing
for f in partners/*/pat-log.csv; do
  echo "=== $f ==="
  awk -F, 'NR>1 && $9=="" {print}' "$f"
done
```

- [ ] Para cada PAT com expiry <30d: agendar Runbook 02 (rotação) na data D-15.
- [ ] Pendências abertas como TODO datado neste arquivo.

### 3. NDAs de novos colaboradores arquivados

- [ ] Se algum freelancer / prestador / advogado entrou no trimestre: NDA assinado + arquivado em `licensing-archive/ndas/YYYY-MM-<slug>.pdf`.
- [ ] Se advogado externo rodou revisão: contrato de honorários arquivado.

### 4. Backup executou nos últimos 7d

- [ ] Checar B2/Wasabi (backup encrypted do monorepo + `licensing-archive`):
  - Last successful backup `>=` D-7.
  - Tamanho consistente com histórico (±20%).
  - Restore test: último realizado em quarter atual ou anterior (senão, agendar).

### 5. GitHub Security Log exportado (mês anterior)

- [ ] Baixar audit log da org `TN-Figueiredo` do mês anterior (Organization settings → Audit log → Export CSV).
- [ ] Salvar em `licensing-archive/audit-logs/YYYY-MM-tn-figueiredo.csv`.
- [ ] Varrer por eventos anômalos: novos collaborators, PATs emitidos fora de fluxo, alterações em branch protection.

```bash
gh api -X GET "orgs/TN-Figueiredo/audit-log?phrase=created:>=YYYY-MM-01+created:<YYYY-MM+1-01" --paginate > audit-log.json
```

### 6. Correspondência não-arquivada

- [ ] Inbox `licensing@figueiredotech.com.br` + pessoal: qualquer thread relativa a parceiro ativo que não foi arquivada em `licensing/partners/<slug>/correspondence/`.
- [ ] Arquivar threads pendentes (`.eml` + anexos).

### 7. Avisos de 90d pendentes

- [ ] LICENSE Art. 20 (ou equivalente do Master): modificações relevantes exigem aviso de 90d aos parceiros ativos.
- [ ] Há alguma modificação pendente de LICENSE / Master / Anexo C (NDA flow-down) que precise de aviso neste quarter? Se sim: enviar comunicado assinado a todos parceiros `active` no registry + arquivar.

### 8. Sanity check financeiro

- [ ] Despesas do trimestre em licenciamento (Clicksign, B2/Wasabi, advogado, domínio) somam dentro do orçamento (<R$ 4.060/ano → <R$ 1.015/trimestre).
- [ ] Se estourou: registrar em `licensing/budget-YYYY.md` + causa.

## Conclusão (2 min)

- [ ] Preencher sumário no topo do arquivo `healthchecks/YYYY-QN.md`:
  - Parceiros ativos: `N`.
  - PATs em rotação pendente: `N`.
  - Incidentes abertos: `N` (link para `licensing/incidents/*/`).
  - Próxima data de healthcheck: D+90.
- [ ] Commit: `chore(licensing): healthcheck YYYY-QN`.
- [ ] Se alguma pendência crítica (PAT expira em <7d e parceiro não respondeu; incidente aberto há >30d; LGPD ANPD deadline): promover para Sprint imediato em vez de aguardar next quarter.

---

**Conclusão:** 15 minutos por trimestre mantêm o processo auditável. Pendências encontradas viram TODO datado + follow-up no próximo quarter (ou Sprint se crítico).
