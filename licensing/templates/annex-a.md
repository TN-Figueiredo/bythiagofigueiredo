# ANEXO A — AUTORIZAÇÃO DE USO ESPECÍFICA

**Instrumento integrante do Acordo Master de Licenciamento de Software celebrado entre FIGUEIREDO TECHNOLOGY LTDA. ("TITULAR") e `[Razão Social do Licenciado]` ("LICENCIADO") em `[Data do Acordo Master]`.**

---

## IDENTIFICAÇÃO DO ANEXO

| Campo | Valor |
|-------|-------|
| **Número sequencial** | `001` (ou subsequente) |
| **Data de emissão** | `[AAAA-MM-DD]` |
| **Data de vigência inicial** | `[AAAA-MM-DD]` |
| **Data de vigência final** | `[AAAA-MM-DD ou "Prazo Indeterminado"]` |
| **Anexo A anterior substituído** | `[número do anexo anterior | "N/A"]` |
| **Status** | `[Ativo | Superseded | Terminated]` |

---

## CONSIDERANDOS ESPECÍFICOS

Este Anexo A é emitido pelo TITULAR ao LICENCIADO, ao amparo das Cláusulas 1 a 3 do Acordo Master vigente, para autorizar uso específico do Software nos estritos termos abaixo delineados. Todas as disposições do Acordo Master, da LICENÇA (Anexo B) e do NDA Flow-Down (Anexo C) aplicam-se integralmente, sem prejuízo dos termos deste Anexo.

Em caso de conflito entre este Anexo A e o Acordo Master, **prevalecerá este Anexo A exclusivamente para o objeto aqui disciplinado**.

---

## SEÇÃO 1 — PACOTES E VERSÕES AUTORIZADOS

Os pacotes abaixo listados estão autorizados para uso pelo LICENCIADO, nas versões e faixas especificadas:

| # | Pacote | Faixa de versões autorizada | Registry | Observações |
|---|--------|------------------------------|----------|-------------|
| 1 | `@tn-figueiredo/[nome]` | `[>=X.Y.Z <A.0.0]` | GitHub Packages | `[opcional]` |
| 2 | `@tn-figueiredo/[nome]` | `[exact: X.Y.Z]` | GitHub Packages | `[opcional]` |
| 3 | ... | ... | ... | ... |

**Regras de versionamento aplicáveis:**

- (a) Atualizações **patch** (X.Y.Z → X.Y.Z+n) são automaticamente abrangidas, ressalvada notificação em contrário pelo TITULAR;
- (b) Atualizações **minor** (X.Y.Z → X.Y+1.0) são abrangidas, salvo indicação de "exact" na tabela acima;
- (c) Atualizações **major** (X.Y.Z → X+1.0.0) exigem Anexo A substitutivo;
- (d) Pacotes **não listados** não estão autorizados para qualquer uso, ainda que publicamente acessíveis.

---

## SEÇÃO 2 — PROJETOS AUTORIZADOS

O Software poderá ser utilizado exclusivamente nos seguintes Projetos:

| # | Nome do Projeto | Domínio / URL | Finalidade | Ambientes autorizados |
|---|-----------------|----------------|------------|------------------------|
| 1 | `[Nome]` | `[https://...]` | `[breve descrição]` | `dev, staging, prod` |
| 2 | `[Nome]` | `[https://...]` | `[breve descrição]` | `[...]` |
| 3 | ... | ... | ... | ... |

**Vedações específicas:**

- (a) Utilização em Projeto não listado configura Violação Material sem Cura;
- (b) Cópia do Software para repositórios diversos dos Projetos acima é vedada, ressalvados backups técnicos conforme Artigo 4.3 da LICENÇA;
- (c) Alterações no rol de Projetos exigem Anexo A substitutivo, observada a antecedência mínima de 10 (dez) dias úteis para comunicação ao TITULAR.

---

## SEÇÃO 3 — USUÁRIOS AUTORIZADOS

As pessoas físicas abaixo nominadas, e somente elas, poderão ter acesso ao Software e aos pacotes licenciados:

| # | Nome completo | CPF | E-mail profissional | Função | Data de início | NDA Anexo C assinado em |
|---|---------------|-----|---------------------|--------|----------------|--------------------------|
| 1 | `[Nome]` | `[XXX.XXX.XXX-XX]` | `[email]` | `[cargo]` | `[AAAA-MM-DD]` | `[AAAA-MM-DD]` |
| 2 | `[Nome]` | `[XXX.XXX.XXX-XX]` | `[email]` | `[cargo]` | `[AAAA-MM-DD]` | `[AAAA-MM-DD]` |
| 3 | ... | ... | ... | ... | ... | ... |

**Regras aplicáveis:**

- (a) O LICENCIADO declara que **cada pessoa acima celebrou NDA Flow-Down** (Anexo C) **previamente** à data de início do acesso;
- (b) Inclusão, exclusão ou substituição de Usuário Autorizado exige comunicação ao TITULAR em até **15 (quinze) dias** e formalização por Anexo A substitutivo;
- (c) O LICENCIADO responde **solidária e ilimitadamente** pelos atos dos Usuários Autorizados, nos termos do Artigo 5.3 da LICENÇA;
- (d) PATs e credenciais são emitidos **nominal e individualmente** aos Usuários Autorizados; compartilhamento de credenciais configura Violação Material sem Cura.

---

## SEÇÃO 4 — RESTRIÇÕES ESPECÍFICAS

Além das condutas proibidas elencadas no **Artigo 6 da LICENÇA (Anexo B)**, aplicam-se ao presente Anexo as seguintes restrições específicas, conforme o caso:

- [ ] **Restrição geográfica:** `[descrever | "N/A"]`
- [ ] **Restrição setorial:** `[descrever | "N/A"]`
- [ ] **Restrição de capacidade:** `[limite de requisições/dia, usuários finais, etc. | "N/A"]`
- [ ] **Restrição de sub-domínio:** `[domínios específicos permitidos | "N/A"]`
- [ ] **Restrição de branding:** `[vedação de uso de marca do TITULAR em mídia paga, etc. | "N/A"]`
- [ ] **Outras restrições:** `[descrever | "N/A"]`

Restrições específicas NÃO previstas neste Anexo seguem o regime geral da LICENÇA e do Acordo Master.

---

## SEÇÃO 5 — CONDIÇÕES COMERCIAIS

**Modelo Comercial aplicável:** `[A — Gratuito com Reciprocidade | B — Comercial Oneroso | C — Híbrido]`

### Se Modelo A (gratuito com reciprocidade):

Reciprocidade definida pelo LICENCIADO:

- [ ] Crédito público visível nos Projetos (atribuição);
- [ ] Divulgação do uso em materiais de comunicação do LICENCIADO;
- [ ] Reporte técnico periódico de bugs e feedback de produto;
- [ ] Contribuição documental ou de testes (sem cessão de código);
- [ ] Permissão de uso do LICENCIADO como caso de sucesso pelo TITULAR;
- [ ] Outra: `[descrever]`.

### Se Modelo B (comercial oneroso):

| Campo | Valor |
|-------|-------|
| Valor anual | **R$ `[valor]`** |
| Reajuste | IPCA anual, na data-base |
| Periodicidade de pagamento | `[mensal | trimestral | anual]` |
| Vencimento | `[dia]` de cada `[período]` |
| Dados bancários do TITULAR | `[banco, agência, conta, PIX]` |
| Forma de cobrança | `[NFS-e, boleto, PIX]` |
| Tributos | Na forma da lei |
| Multa por atraso | 2% + juros 1% a.m. + IPCA |

### Se Modelo C (híbrido):

- **Ano 1:** `[Gratuito / Modelo A com reciprocidade: descrever]`
- **Gatilho de renegociação:** `[data ou condição]`
- **Ano 2 e seguintes:** `[Modelo B, valor a ser pactuado em Anexo A substitutivo no mês 10 do ano 1]`
- **Fallback em ausência de acordo:** aplicação do Artigo 7.3 da LICENÇA (término por conveniência).

### Calibragem de cláusula penal para este Anexo

A cláusula penal aplicável a este Anexo, em derrogação ao Artigo 9.1 da LICENÇA, é fixada em: **R$ `[valor]`** ou `[N × Licença Comercial Equivalente]`, o que for maior. Fundamentação: `[ex.: "calibrada ao porte de parceiro familiar, mantidas demais disposições de cláusula penal"]`.

Se nenhuma calibragem for indicada nesta seção, aplicam-se integralmente os valores do Artigo 9 da LICENÇA.

---

## SEÇÃO 6 — CONTROLE TÉCNICO

### PATs (Personal Access Tokens)

O TITULAR emitirá, em favor do LICENCIADO, **02 (dois) PATs fine-grained**, identificados abaixo:

| PAT | Finalidade | Escopo | Emitido em | Expira em | Rotação |
|-----|-----------|--------|-----------|-----------|---------|
| **PAT-DEV** | Desenvolvimento local pelos Usuários Autorizados | repo `tnf-ecosystem` + `Contents:read` + `Packages:read` | `[AAAA-MM-DD]` | `[AAAA-MM-DD]` (180 dias) | A cada 180 dias |
| **PAT-CI** | Integração contínua nos Projetos autorizados | repo `tnf-ecosystem` + `Contents:read` + `Packages:read` | `[AAAA-MM-DD]` | `[AAAA-MM-DD]` (180 dias) | A cada 180 dias |

### Obrigações do LICENCIADO quanto aos PATs

- (a) **Armazenamento seguro:** PATs devem ser mantidos em vaults de segredos (GitHub Actions Secrets, 1Password, Vault, AWS Secrets Manager ou equivalente), vedado armazenamento em texto claro, repositórios Git ou mensageria;
- (b) **Não-compartilhamento:** PATs são nominais à infraestrutura do LICENCIADO e não podem ser compartilhados com Usuários não-autorizados;
- (c) **ATUALIZAÇÃO DE SISTEMAS APÓS ROTAÇÃO:** quando da rotação periódica (a cada 180 dias) ou de rotação extraordinária por requisição do TITULAR, o LICENCIADO obriga-se a atualizar **todos os sistemas** (CI/CD pipelines, ambientes de build, workstations dos Usuários Autorizados) em prazo máximo de **48 (quarenta e oito) horas** contadas da emissão do novo PAT pelo TITULAR, de modo a evitar interrupções e a permitir a revogação tempestiva do PAT anterior;
- (d) **Notificação de comprometimento:** qualquer suspeita de comprometimento dos PATs deve ser notificada ao TITULAR em até 48 horas, para revogação imediata.

### Outside Collaborator Access

Os Usuários Autorizados serão adicionados como **outside collaborators** (read-only) ao repositório `TN-Figueiredo/tnf-ecosystem`, com acesso revogável a critério exclusivo do TITULAR, observados os requisitos:

- (a) Identificação do usuário GitHub correspondente ao CPF do Usuário Autorizado;
- (b) Habilitação obrigatória de 2FA na conta GitHub do Usuário Autorizado;
- (c) Revogação imediata em caso de desligamento do Usuário ou término da Autorização.

---

## SEÇÃO 7 — ASSINATURAS

E por estarem assim justas e autorizadas, as Partes firmam o presente Anexo A, que integra o Acordo Master e produz plenos efeitos jurídicos a partir da data de vigência inicial indicada na Seção de Identificação.

`[Local]`, `[Data]`.

**TITULAR:**

________________________________________
**FIGUEIREDO TECHNOLOGY LTDA.**
CNPJ: 44.243.373/0001-69
Representante: Thiago Figueiredo
Cargo: Sócio-Administrador
E-mail: `licensing@bythiagofigueiredo.com`

**LICENCIADO:**

________________________________________
**`[Razão Social]`**
CNPJ: `[CNPJ]`
Representante: `[Nome]`
Cargo: `[Cargo]`
E-mail: `[E-mail]`

---

*Fim do Anexo A #`[número]` — emitido em `[AAAA-MM-DD]`.*
