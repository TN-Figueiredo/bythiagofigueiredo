# ROPA — Registro de Operações de Tratamento de Dados Pessoais

**Processo:** Licenciamento do ecossistema `@tn-figueiredo/*`
**Controlador:** Figueiredo Technology LTDA — CNPJ 44.243.373/0001-69
**Versão do registro:** 1.0 (DRAFT — 2026-04-16)
**Base legal:** Lei 13.709/2018 (LGPD) Art. 37
**Revisão:** anual ou por mudança material no processo (o que ocorrer primeiro)

> **Status:** DRAFT — pendente de revisão jurídica (Fase 0 do plano de implementação).
> Este ROPA descreve o tratamento de dados pessoais estritamente vinculado ao processo de **licenciamento de software proprietário** a parceiros B2B (PJ ↔ PJ). Tratamentos realizados em outras finalidades da Figueiredo Technology LTDA têm ROPAs próprios.

---

## 1. Finalidade do tratamento

Execução do Acordo Master de Licenciamento e respectivos Anexos A (autorizações específicas) celebrados entre a Figueiredo Technology LTDA (Titular dos direitos, Controladora LGPD) e parceiros pessoas jurídicas (Licenciados). O tratamento de dados pessoais é **acessório e necessário** à gestão da relação contratual, incluindo:

- Identificação inequívoca do representante legal do Licenciado para fins de assinatura eletrônica e notificações formais.
- Nominalização de Usuários Autorizados (pessoas físicas vinculadas ao Licenciado) para fins de controle de acesso, trilha de auditoria e accountability.
- Cumprimento de obrigações legais de guarda documental (Código Civil, Lei 9.609/98, LGPD).

## 2. Base legal (LGPD Art. 7)

| Operação | Base legal | Fundamentação |
|----------|------------|---------------|
| Coleta de dados do representante legal e Usuários Autorizados | **Art. 7, V** — execução de contrato | Dados são imprescindíveis para cumprimento do Acordo Master e Anexos A. |
| Guarda de logs de acesso (GitHub PATs, timestamps, fingerprints) | **Art. 7, IX** — legítimo interesse | Accountability contratual e defesa em eventual disputa (LICENSE Arts. 5.2, 9, 10); teste de balanceamento documentado em item 9. |
| Retenção pós-término por 5 anos de sobrevivência de confidencialidade | **Art. 7, IX** — legítimo interesse + Art. 16, II — cumprimento de obrigação legal/regulatória | Sobrevivência contratual (LICENSE Art. 8.2) + prazo prescricional civil. |

## 3. Categorias de titulares

| Categoria | Relação com o Controlador |
|-----------|---------------------------|
| Representantes legais de Licenciados | Pessoa física com poderes estatutários/contratuais de representação da PJ parceira. |
| Usuários Autorizados | Pessoas físicas nominadas no Anexo A vinculadas ao Licenciado por contrato de trabalho, prestação de serviços ou sociedade. |
| Testemunhas de assinatura do Master | Duas pessoas físicas indicadas pela Titular para assinatura dos instrumentos. |

**Não inclui:** titulares finais dos serviços do Licenciado (clientes/usuários do parceiro) — estes são controlados pelo Licenciado, conforme LICENSE Art. 14.1.

## 4. Categorias de dados pessoais tratados

| Dado | Fonte | Natureza | Sensível? |
|------|-------|----------|-----------|
| Nome completo | Contrato Master e Anexo A | Identificação | Não |
| CPF | Contrato Master, Anexo A, NDAs | Identificação | Não |
| E-mail profissional/corporativo | Contrato, correspondência | Contato | Não |
| Cargo ou função | Anexo A | Profissional | Não |
| Data de início do acesso | Anexo A | Funcional | Não |
| Endereço eletrônico para notificações formais | Cláusula 14.2 do Master | Contato | Não |
| Assinatura eletrônica (IP, timestamp, trilha Clicksign/D4Sign) | Plataforma de assinatura | Autenticação | Não |
| Fingerprint SHA-256 dos últimos 4 chars de PAT emitido | `pat-log.csv` | Segurança (não reversível) | Não |

**Dados sensíveis (LGPD Art. 5, II):** nenhum. O processo foi desenhado para evitar coleta de dados de saúde, origem racial ou étnica, convicções, dados biométricos etc.

## 5. Compartilhamento com terceiros

| Operador/Destinatário | Finalidade | Dados compartilhados | Base legal do compartilhamento |
|-----------------------|------------|----------------------|--------------------------------|
| **Clicksign** (ou D4Sign alternativo) | Assinatura eletrônica dos instrumentos | Nome, CPF, e-mail, IP | Art. 7, V (execução de contrato) |
| **GitHub, Inc.** | Gestão de PATs e outside collaborators do repo `tnf-ecosystem` | Username GitHub do Usuário Autorizado | Art. 7, V |
| **Backblaze (B2)** | Backup encriptado GPG do `licensing-archive` | Dados encriptados em repouso (sem acesso em claro) | Art. 7, IX + Art. 46 (medidas de segurança) |

**Nenhum compartilhamento comercial, publicitário ou de perfilamento.** Operadores assinam DPA (Data Processing Agreement) próprio ou se submetem a Termos de Serviço que incluem cláusulas LGPD-compatíveis (Clicksign é adequado a LGPD + ICP-Brasil; GitHub possui DPA + SCCs; Backblaze oferece DPA corporativo).

## 6. Transferência internacional

- **GitHub, Inc. (EUA):** fundamento Art. 33, II (transferência necessária à execução do contrato entre Controladora e titular) + SCCs (Standard Contractual Clauses) GitHub-LGPD disponíveis em `github.com/site/privacy`.
- **Backblaze (EUA):** fundamento Art. 33, II + medidas adicionais (encriptação GPG com chave exclusivamente sob controle da Controladora, no Brasil).
- **Clicksign:** servidor Brasil, sem transferência internacional.

Na concessão futura de autorização pelo ANPD ou adequação pela Resolução CD/ANPD 19/2023, migrar para mecanismos específicos (cláusulas-padrão ANPD). Reavaliação anual.

## 7. Período de retenção

| Dado | Prazo mínimo | Prazo máximo | Fundamentação |
|------|--------------|--------------|---------------|
| Master Agreement + Anexos A assinados | 10 anos | 10 anos | 5 anos durante Licença + 5 anos sobrevivência confidencialidade (LICENSE Art. 8.2) |
| NDAs de Usuários Autorizados | Durante vínculo + 5 anos | 10 anos | Sobrevivência pós-desligamento + prescrição civil |
| `pat-log.csv` | Durante vínculo ativo | 10 anos pós-término | Accountability de acesso (LICENSE Art. 10) + prescrição |
| `registry.csv` | Durante vínculo ativo | 10 anos pós-término | Mesma finalidade acima |
| Correspondência formal | Durante vínculo | 10 anos pós-término | Defesa em eventual disputa |
| Relatórios de auditoria | Durante vínculo | 10 anos pós-término (LICENSE Art. 10 sobrevive 2 anos; estende-se por precaução civil) | Evidência documental |
| Declarações de destruição | Durante vínculo | 10 anos pós-término | Prova do cumprimento de LICENSE Art. 7.5 |

**Procedimento de eliminação:** após o prazo máximo, dados são apagados do `licensing-archive` e dos backups B2 via rotação de chave GPG + purge do bucket. Registro de eliminação é mantido por 6 meses adicionais em log dedicado.

## 8. Direitos dos titulares (LGPD Art. 18)

Os titulares podem exercer os seguintes direitos mediante requisição formal ao endereço `juridico@bythiagofigueiredo.com`:

| Direito | Art. LGPD | Viabilidade | Observações |
|---------|-----------|-------------|-------------|
| Confirmação de tratamento | 18, I | ✅ | Resposta em até 15 dias úteis |
| Acesso | 18, II | ✅ | Cópia dos registros em formato portável |
| Correção | 18, III | ✅ | Atualização direta em registry.csv e Anexo A substitutivo se necessário |
| Anonimização/bloqueio/eliminação | 18, IV | ⚠️ Parcial | Dados necessários à execução de contrato ou guarda legal não podem ser eliminados antes do fim do período de retenção |
| Portabilidade | 18, V | ✅ | Exportação em CSV/JSON |
| Eliminação de dados tratados com consentimento | 18, VI | ❌ | Não aplicável — base legal é execução de contrato + legítimo interesse, não consentimento |
| Informação sobre compartilhamentos | 18, VII | ✅ | Lista de operadores em item 5 deste ROPA |
| Informação sobre possibilidade de não fornecer consentimento | 18, VIII | ❌ | Não aplicável — base legal não é consentimento |
| Revogação de consentimento | 18, IX | ❌ | Não aplicável |

## 9. Teste de balanceamento — Legítimo Interesse (LGPD Art. 10)

**Interesse legítimo invocado:** controle de acesso ao segredo de negócio da Figueiredo Technology LTDA (packages `@tn-figueiredo/*`) + accountability contratual + defesa em eventual disputa judicial ou arbitral.

**Teste:**

1. **Legitimidade:** o interesse é amparado por lei (Lei 9.279/96 Art. 195 — segredo de negócio; CC Art. 187 — abuso de direito; CPC Art. 497 — execução específica). ✅
2. **Necessidade:** a manutenção de `pat-log.csv` e `registry.csv` é o meio menos invasivo para comprovar quem acessou quais packages, quando e sob qual autorização. Alternativas (não manter logs) inviabilizam auditoria contratual e defesa. ✅
3. **Balanceamento:** os dados são de natureza **profissional** (nome, CPF, e-mail corporativo, cargo) — **não sensíveis**, coletados em contexto B2B onde o titular é representante legal ou colaborador formalmente designado pela PJ parceira para interagir com o software. A expectativa razoável do titular é de que seu envolvimento seja registrado. Medidas de segurança (item 10) mitigam risco. ✅

**Conclusão:** legítimo interesse aplicável; prevalece sobre interesses, direitos e liberdades fundamentais do titular nesse contexto específico.

## 10. Medidas de segurança (LGPD Art. 46)

### Técnicas

- Repositório `TN-Figueiredo/licensing-archive` **privado** no GitHub; acesso restrito exclusivamente ao representante legal da Controladora (sem collaborators adicionais).
- **2FA obrigatório** (TOTP) na conta GitHub do representante legal.
- **Backup semanal** GPG-encrypted para Backblaze B2; passphrase armazenada em 1Password Vault pessoal + cópia física offline (gaveta trancada / cofre).
- **Rotação obrigatória** de PATs a cada 180 dias; revogação imediata em caso de suspeita de comprometimento.
- **Fingerprint SHA-256** dos tokens em `pat-log.csv` — nunca o token em claro.
- `registry.csv` e outros artefatos com PII versionados no Git — histórico imutável.

### Organizacionais

- NDA flow-down exigido de cada Usuário Autorizado antes do primeiro acesso.
- Runbook 06 (`quarterly-healthcheck.md`) — revisão trimestral de dados, PATs, backups, NDAs.
- Runbook 05 (`incident-response.md`) — notificação ao titular em até 48h em caso de incidente de segurança envolvendo seus dados; notificação à ANPD em prazo razoável conforme Art. 48 + Resolução CD/ANPD 15/2024.
- Auditoria anual conforme LICENSE Art. 10.

### Físicas

- Nenhum dado pessoal armazenado fora de sistemas criptografados ou de nuvens adequadas (sem arquivos em papel ou pendrives em circulação).

## 11. Encarregado de Dados (DPO)

**Dispensa formal:** Figueiredo Technology LTDA qualifica-se como **agente de pequeno porte** nos termos da **Resolução CD/ANPD nº 2, de 27 de janeiro de 2022** (Art. 11). Não há obrigação de indicação formal de Encarregado. Contato para questões de privacidade:

- **E-mail dedicado:** `juridico@bythiagofigueiredo.com` (ou `privacidade@bythiagofigueiredo.com` se habilitado)
- **Representante:** Thiago Figueiredo, sócio-administrador
- **Prazo de resposta:** até 15 dias úteis conforme LGPD Art. 19

Se o porte da Controladora evoluir para médio ou grande porte (Resolução CD/ANPD 2/2022 Art. 2), Encarregado formal será designado em 30 dias da mudança de enquadramento.

## 12. Incidentes de segurança

Procedimento completo em `licensing/runbooks/05-incident-response.md`. Fluxo resumido:

1. **Contenção** em até 1 hora da ciência.
2. **Triagem** em até 24 horas — classificação de severidade e escopo.
3. **Notificações**:
   - Titulares afetados: em até 48 horas (LGPD Art. 48 §1).
   - ANPD: em prazo razoável — meta interna de 48 horas para incidentes com risco relevante, conforme Resolução CD/ANPD 15/2024.
   - Parceiro Licenciado: sempre em até 48 horas.
4. **Investigação** com preservação de chain of custody.
5. **Remediação** + patch.
6. **Post-mortem** arquivado em `partners/<slug>/correspondence/YYYY-MM-DD-incident.md`.

## 13. Revisão e governança do ROPA

- **Revisão periódica:** anual, coincidente com o `quarterly-healthcheck` do último trimestre do ano.
- **Revisão extraordinária:** em caso de (a) inclusão de novo operador/compartilhamento; (b) mudança de base legal; (c) alteração de LICENSE que afete tratamento de dados; (d) incidente de segurança; (e) nova orientação da ANPD aplicável.
- **Histórico de versões:**

| Versão | Data | Alteração | Responsável |
|--------|------|-----------|-------------|
| 1.0 DRAFT | 2026-04-16 | Versão inicial, pendente revisão jurídica | Thiago Figueiredo |

---

**Arquivo canônico:** `licensing/templates/ropa-licensing.md`
**Espelho após migração:** `TN-Figueiredo/licensing-archive/compliance/ropa-licensing.md`
**Referência cruzada:** LICENSE v1 Artigo 14 (LGPD e Proteção de Dados); Master Agreement Cláusula 10.
