# Runbook 04 — Conduzir Auditoria Anual

**Quando usar:** Exercício anual opt-in do direito de auditoria previsto em LICENSE Art. 10 + Master Agreement Cláusula 11. Também aplicável em cenário reativo (suspeita de violação detectada; se confirmado material, escalar para Runbook 05).

**Periodicidade:** Até 1x por ano por parceiro, exceto se houver suspeita fundamentada (sem limite, conforme LICENSE Art. 10.4).

**Custo:** Licenciante arca; se auditoria revelar violação material, custos são reembolsáveis pelo licenciado (LICENSE Art. 10.5 + cláusula penal do Master).

**Executor:** Figueiredo Tech + auditor externo independente (recomendação: contador PJ ou empresa de compliance; NDA próprio com o licenciado).

**SLA interno:** 10 dias úteis de aviso → 30 dias corridos para coleta → 15 dias corridos para relatório → até 45 dias total do aviso ao relatório final.

**Referências:** LICENSE Art. 10 (Auditoria), Master Agreement Cláusula 11, Runbook 05 (escalação se material).

---

## Passo 1 — Planejamento (D-10 dias úteis)

- [ ] Definir escopo da auditoria:
  - Parceiro(s) alvo + razão (rotina anual OU suspeita específica).
  - Período temporal auditado (ex: últimos 12 meses).
  - Packages e projetos sob escopo (referência ao Anexo A vigente).
  - Tipos de evidência a coletar (logs de uso, lista de Usuários Autorizados, amostra aleatória de código que consome `@tn-figueiredo/*`, comprovantes de destruição se houver rescisão pendente).
- [ ] Selecionar auditor externo + validar independência (sem vínculo societário/empregatício com licenciante ou licenciado nos últimos 24 meses).
- [ ] Auditor assina **NDA próprio diretamente com o licenciado** (LICENSE Art. 10.2) — não é flow-down do NDA do Master. Template: `licensing/templates/auditor-nda.md`.
- [ ] Estimar custos (honorários auditor + ferramentas). Reservar em `licensing/budget-YYYY.md`.

## Passo 2 — Aviso formal ao parceiro (D-10)

Enviar via e-mail assinado PGP + Clicksign. Arquivar em `licensing/partners/<slug>/correspondence/YYYY-MM-DD-audit-notice.eml`.

### Template de e-mail (copiar/colar + editar)

```
Para: <contato técnico + contato jurídico do parceiro>
CC: <advogado de Figueiredo Tech>
Assunto: [Figueiredo Tech] Aviso de auditoria anual — <razão social parceiro> — LICENSE Art. 10

Prezados,

Em conformidade com a Cláusula 10 do Contrato de Licenciamento (LICENSE v1.2)
e a Cláusula 11 do Master Agreement firmado em <data>, comunicamos a
realização de auditoria ordinária referente ao período <dd/mm/aaaa> a
<dd/mm/aaaa>.

Escopo:
  - Projetos: <lista do Anexo A vigente>
  - Packages: @tn-figueiredo/*
  - Evidências solicitadas:
      1. Lista atualizada de Usuários Autorizados com CPF + papel.
      2. Logs de build/CI dos últimos 90 dias mostrando consumo dos packages.
      3. Amostra de código (até 10 arquivos escolhidos pelo auditor) que
         consome os packages licenciados.
      4. Declaração de cumprimento assinada pelo representante legal.

Auditor designado: <nome + CNPJ/CPF>. NDA próprio será celebrado diretamente
com essa empresa conforme LICENSE Art. 10.2. O auditor entrará em contato em
<D+3 dias úteis> para agendar coleta.

Prazo de entrega das evidências: até <D+30 dias corridos>.
Relatório preliminar: até <D+45 dias corridos>.

Os custos desta auditoria correm por conta do licenciante, exceto se
apuradas violações materiais (LICENSE Art. 10.5).

Atenciosamente,
Thiago Figueiredo
Figueiredo Tech
licensing@figueiredotech.com.br
```

## Passo 3 — Coleta de evidências (D+0 a D+30)

- [ ] Auditor estabelece canal seguro com contato técnico do parceiro (S/FTP, repo privado temporário, ou link com expiry).
- [ ] Auditor verifica:
  - [ ] Lista de Usuários Autorizados bate com último Anexo A assinado (nenhum usuário extra; nenhum ausente).
  - [ ] PATs em uso correspondem aos registrados em `licensing/partners/<slug>/pat-log.csv` (via `token_suffix_sha256`).
  - [ ] Logs de CI não evidenciam redistribuição pública de artefatos (upload a npmjs.org, Docker Hub público, CDN, etc).
  - [ ] Amostra de código não contém fork ou vendoring de `@tn-figueiredo/*` (consumo via dependency only).
  - [ ] Headers SPDX preservados em forks internos (se houver).
- [ ] Auditor produz **working papers** (papéis de trabalho) — ficam com ele, sujeitos ao NDA próprio.

## Passo 4 — Relatório (D+30 a D+45)

- [ ] Auditor entrega relatório a Figueiredo Tech com:
  - Sumário executivo.
  - Metodologia.
  - Findings classificados: `conforme` / `observação` (não-material) / `violação material`.
  - Recomendações.
- [ ] Arquivar em `licensing/partners/<slug>/audits/YYYY-audit-report.pdf`.
- [ ] Compartilhar sumário executivo com parceiro; findings detalhados só se houver violação material.

## Passo 5 — Disposição

- [ ] **Se tudo conforme:** enviar e-mail de encerramento ao parceiro (arquivar em `correspondence/`); atualizar `registry.csv` com `last_audit_at`.
- [ ] **Se observação não-material:** enviar recomendações ao parceiro com prazo de 30d para remediar; reauditar em D+60.
- [ ] **Se violação material:** acionar Runbook 05 imediatamente; advogado de PI é notificado; cláusula penal do Master é invocada; custos da auditoria são cobrados do licenciado (LICENSE Art. 10.5).

---

**Conclusão:** Auditoria documentada ponta a ponta. Relatório arquivado ≥10 anos. Findings material → Runbook 05. Parceiro tem contraditório garantido via acesso ao sumário executivo.
