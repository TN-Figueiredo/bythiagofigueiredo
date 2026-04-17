# Runbook 05 — Resposta a Incidentes

**Quando usar:** Qualquer evento que possa comprometer integridade, confidencialidade, ou conformidade do ecossistema `@tn-figueiredo/*` licenciado.

**Tipos de incidente:**

- **Tipo 1 — Violação por parceiro** (redistribuição não autorizada, fork público, cessão a terceiro, descumprimento de Anexo A).
- **Tipo 2 — Violação por terceiro** (fork não autorizado por ator externo, vazamento via ex-funcionário do parceiro, descoberta em repo público de terceiros).
- **Tipo 3 — Vulnerabilidade de segurança** em package `@tn-figueiredo/*` que exponha dados ou permita cadeia de supply chain attack.
- **Tipo 4 — Incidente LGPD** envolvendo dados pessoais dos Usuários Autorizados (CPF, e-mail profissional) armazenados no `licensing-archive`.

**Executor:** Thiago Figueiredo + advogado de PI sob demanda + ANPD se Tipo 4.

**Gatilho para ação judicial:** Dano estimado > **R$ 50.000** (penal OU real) **E** resistência do responsável **E** viabilidade confirmada por escrito pelo advogado. Abaixo desse limiar: tratamento administrativo + registro + compliance forçado.

**Referências:** LICENSE Art. 7 (Rescisão), Art. 10 (Auditoria), Master Cláusula 12 (Cláusula penal), LGPD Art. 48 (notificação à ANPD), Runbook 03 (revogação), Runbook 04 (auditoria).

---

## Fase 1 — Contenção (≤1h do detectar)

Prioridade absoluta. Parar o sangramento antes de qualquer análise.

- [ ] Identificar o vetor:
  - Tipo 1/2: qual repo/site/registro está com o material exposto? URL exata.
  - Tipo 3: qual package/versão? Qual CVE-like?
  - Tipo 4: qual dado? Qual subset de parceiros/Usuários?
- [ ] **Tipo 1:** aplicar Runbook 03 Fluxo A (revogação total do parceiro) de forma cautelar — reversível se investigação inocentar.
- [ ] **Tipo 2:** se fork público em GitHub/GitLab/Bitbucket → **DMCA takedown notice** imediato (template: `licensing/templates/dmca-takedown.md`); se é cópia em registro npm/PyPI → abrir ticket de takedown no registro.
- [ ] **Tipo 3:** se package `@tn-figueiredo/*` está em prod de parceiros → publicar patch release mínimo + GitHub Security Advisory (privado inicialmente); notificar parceiros afetados com workaround.
- [ ] **Tipo 4:** isolar sistema com dado comprometido; desconectar de redes externas se possível.
- [ ] Abrir arquivo de incidente: `licensing/incidents/YYYY-MM-DD-<slug-descritivo>/README.md` com timestamp de detecção, vetor, ações imediatas.

## Fase 2 — Triagem (≤24h)

- [ ] Classificar severidade:
  - **Crítica:** dano material confirmado OU exposição em larga escala OU Tipo 4 com dado sensível.
  - **Alta:** violação confirmada mas contida; sem exposição pública.
  - **Média:** suspeita fundamentada sem confirmação.
  - **Baixa:** observação menor, sem dano estimável.
- [ ] Estimar dano em R$:
  - Licenças não pagas × valor do contrato.
  - Downloads públicos × CPI estimado (sem base, usar Master Cláusula 12 como floor).
  - Se Tipo 4: dano moral estimado por Usuário conforme LGPD Art. 42.
- [ ] Decidir escalação:
  - Se Crítica OU > R$ 50.000 → acionar advogado de PI (ligação + e-mail + contrato de urgência se ainda não houver).
  - Se Tipo 4 → preparar notificação ANPD (Fase 3).

## Fase 3 — Notificações (≤48h)

- [ ] **Sempre:** notificar parceiro envolvido por escrito. Arquivar `licensing/incidents/<pasta>/notification-partner.eml`.
- [ ] **Se Tipo 4 (LGPD):** notificar ANPD via formulário <https://www.gov.br/anpd/pt-br> em até 48h; notificar titulares afetados em até 72h (CPF, e-mail profissional, dados de Usuários Autorizados armazenados em `licensing-archive`).
- [ ] **Se material (> R$ 50k + resistência):** advogado emite notificação extrajudicial ao responsável (cartório de títulos e documentos) com prazo para remediação (tipicamente 5-15 dias).
- [ ] **Se Tipo 2 e terceiro identificado:** DMCA já enviado na Fase 1; se não cumprido em 48h, escalar para take-down manual via provedor.
- [ ] **Se contrato de seguro cibernético existente:** notificar seguradora dentro da janela contratual (tipicamente 72h).

## Fase 4 — Investigação (preserve chain of custody)

- [ ] Preservar evidências digitais:
  - Screenshots com timestamp visível + URL + hash SHA-256 do arquivo salvo.
  - `wget --mirror` ou `git clone` do material violador (arquivar offline).
  - Headers HTTP + `whois` do domínio se Tipo 2.
  - Logs do GitHub (`gh api /repos/OWNER/REPO/traffic/clones`, security audit log) dos últimos 30d.
- [ ] **Chain of custody:** cada arquivo coletado tem documento associado em `licensing/incidents/<pasta>/chain-of-custody.md` com: quem coletou, quando, de onde, hash SHA-256, onde foi armazenado.
- [ ] Se ação judicial provável: advogado orienta sobre preservação admissível (ata notarial pode substituir screenshot para prova cível).
- [ ] Reconstituir timeline com todos eventos + evidências.

## Fase 5 — Remediação

- [ ] **Tipo 1:** Runbook 03 Fluxo A completo + cobrança de cláusula penal (Master Cláusula 12) + declaração de destruição (LICENSE 7.5).
- [ ] **Tipo 2:** takedown executado + monitoramento por 90d de ressurgimento; se advogado concluir viabilidade + dano > R$ 50k: ação judicial (cível por violação de direitos autorais + penal Art. 184 CP se aplicável).
- [ ] **Tipo 3:** patch liberado + GSA pública após window + pós-mortem técnico (Fase 6).
- [ ] **Tipo 4:** aplicar medidas corretivas conforme plano de ação enviado à ANPD; atualizar ROPA em `licensing-archive/compliance/ropa-licensing.md`.

## Fase 6 — Post-mortem

- [ ] Dentro de 30d do encerramento, produzir `licensing/incidents/<pasta>/post-mortem.md`:
  - Timeline cronológico.
  - Root cause.
  - O que funcionou na resposta.
  - O que falhou.
  - Ações preventivas com dono + prazo.
- [ ] Revisar runbooks afetados e patch in-place.
- [ ] Atualizar `licensing/registry.csv` (status do parceiro, data do último incidente).
- [ ] Arquivar pasta do incidente definitivamente (retenção ≥10 anos).

---

**Conclusão:** Incidente tem trilha de timestamps defensável em juízo. Ação judicial só se (penal > R$ 50k) ∧ (resistência) ∧ (advogado OK). Tipo 4 tem gatilho ANPD automático ≤48h.
