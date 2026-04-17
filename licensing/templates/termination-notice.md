# NOTIFICAÇÃO FORMAL DE TÉRMINO DE ACORDO MASTER E AUTORIZAÇÕES DE USO

**Documento jurídico vinculante. Emitido nos termos do Artigo 7 da LICENÇA PROPRIETÁRIA FIGUEIREDO TECHNOLOGY v1 (`LicenseRef-Proprietary-FigueiredoTech-v1`) e da Cláusula 7 do Acordo Master.**

---

## CABEÇALHO

| Campo | Valor |
|-------|-------|
| **Número da notificação** | `TN-[AAAA]-[NNN]` |
| **Data de emissão** | `[AAAA-MM-DD]` |
| **Meio de envio** | `[Carta AR | E-mail com confirmação | Cartório RTD | Plataforma Clicksign/D4Sign]` |
| **Destinatário** | `[Razão Social do Licenciado]` |
| **Emitente** | FIGUEIREDO TECHNOLOGY LTDA. |

---

## PARTES

**EMITENTE (Notificante):**

**FIGUEIREDO TECHNOLOGY LTDA.**, CNPJ 44.243.373/0001-69, com sede em `[endereço cadastrado na Junta Comercial]`, neste ato representada por **Thiago Figueiredo**, na qualidade de sócio-administrador, e-mail `juridico@figueiredotech.com.br` (doravante "TITULAR").

**DESTINATÁRIO (Notificado):**

**`[Razão Social do Licenciado]`**, CNPJ `[CNPJ]`, com sede em `[endereço]`, representada por **`[nome do representante legal]`**, CPF `[CPF]`, e-mail `[e-mail]` (doravante "LICENCIADO").

---

## REFERÊNCIAS CONTRATUAIS

| Instrumento | Identificação | Data |
|-------------|----------------|------|
| **Acordo Master de Licenciamento** | `[nº ou identificador]` | `[AAAA-MM-DD]` |
| **Anexo A em vigor (mais recente)** | `#[número sequencial]` | `[AAAA-MM-DD]` |
| **Anexos A anteriores (SUPERSEDED)** | `#001, #002, ...` | `[...]` |
| **LICENÇA aplicável** | `LicenseRef-Proprietary-FigueiredoTech-v1` (Anexo B) | v1.2 — 2026-04-16 |

---

## 1. FUNDAMENTO DO TÉRMINO

O TITULAR, no exercício regular de seus direitos contratuais e nos termos do Acordo Master e da LICENÇA aplicáveis, NOTIFICA formalmente o LICENCIADO do término de todas as autorizações vigentes, com base na seguinte hipótese (marcar **uma** das opções):

- [ ] **1.1. Término por Conveniência do TITULAR** (LICENÇA Art. 7.3 + Acordo Master Cláusula 7.2)
  - Não há necessidade de motivação. Aviso com antecedência mínima de **90 (noventa) dias**.
  - Data efetiva do término: `[data da emissão + 90 dias]`

- [ ] **1.2. Término por Violação Material com Cura não sanada** (LICENÇA Art. 7.1)
  - Fato caracterizador: `[descrição objetiva do descumprimento]`
  - Notificação de cura anterior: `[número / data]`, concedendo 30 (trinta) dias para restauração.
  - Situação atual: `[descumprimento persistente, não restaurado no prazo]`
  - Data efetiva do término: **imediata**, a partir do recebimento desta notificação.

- [ ] **1.3. Término por Violação Material sem Cura** (LICENÇA Art. 7.2)
  - Fato caracterizador: `[descrição detalhada da conduta]`
  - Enquadramento: `[Art. 6.1 da LICENÇA, alínea (X) — ex.: "(a) redistribuição não autorizada", "(c) engenharia reversa", "(e) treinamento de IA", "(h) benchmarks comerciais", etc.]`
  - Evidências: `[indicar documentos, logs, prints, relatório de auditoria, etc.]`
  - Data efetiva do término: **imediata**, a partir do recebimento desta notificação.

- [ ] **1.4. Término por Mudança de Controle não autorizada** (LICENÇA Art. 7.4(d) + Art. 13.2)
  - Evento caracterizador: `[descrição — ex.: "operação societária concluída em DD/MM/AAAA sem notificação prévia ao TITULAR"]`
  - Data efetiva do término: **imediata**, de pleno direito.

- [ ] **1.5. Término por Insolvência ou Eventos Análogos** (LICENÇA Art. 7.4)
  - Evento caracterizador: `[pedido de recuperação judicial / falência / liquidação / protesto reiterado / cessação de atividades]`
  - Data efetiva do término: **imediata**, de pleno direito.

---

## 2. DATA EFETIVA DO TÉRMINO

Com base no fundamento assinalado acima, fica determinada a seguinte data efetiva do término:

**DATA EFETIVA DO TÉRMINO: `[AAAA-MM-DD]`**

A partir desta data, cessam todos os direitos de uso do Software pelo LICENCIADO, seus Usuários Autorizados e quaisquer terceiros vinculados, independentemente de qualquer outra formalidade.

---

## 3. OBRIGAÇÕES DO LICENCIADO A PARTIR DA DATA EFETIVA

Nos termos do **Artigo 7.5 da LICENÇA** e da **Cláusula 7.4 do Acordo Master**, o LICENCIADO obriga-se, no **prazo máximo e improrrogável de 10 (dez) dias corridos** contados da data efetiva do término, a:

3.1. **Cessar imediatamente todo e qualquer uso do Software**, em todos os ambientes técnicos (desenvolvimento, homologação, produção, CI/CD);

3.2. **Desinstalar o Software de todos os ambientes**, incluindo remoção de dependências `@tn-figueiredo/*` dos projetos, revogação de build artifacts contendo o Software e purge de caches de package managers;

3.3. **Destruir, de forma irreversível, todas as cópias do Software** em sua posse, guarda ou controle — em código-fonte, binário, container, imagem, snapshot, backup, repositório local, cloud storage, pen drive, mídia física ou qualquer outro meio — inclusive em máquinas pessoais dos Usuários Autorizados;

3.4. **APRESENTAR DECLARAÇÃO FORMAL DE DESTRUIÇÃO** ao TITULAR, conforme modelo no item 6 abaixo, em prazo máximo de **10 (dez) dias corridos** contados da data efetiva do término, assinada por representante legal com poderes suficientes;

3.5. **Devolver ou destruir toda e qualquer Informação Confidencial** do TITULAR, incluindo documentação técnica, credenciais e demais conteúdos;

3.6. **Cancelar e devolver** todos os PATs (Personal Access Tokens), tokens, chaves de API e demais credenciais emitidos em razão do Acordo Master;

3.7. **Revogar acesso** dos Usuários Autorizados a quaisquer repositórios, registries ou sistemas do TITULAR em que tenham sido adicionados como outside collaborators.

**ATENÇÃO:** a não-apresentação da declaração de destruição no prazo de 10 dias (item 3.4) será considerada **descumprimento adicional**, sujeitando o LICENCIADO à multa diária do Artigo 9.2 da LICENÇA, sem prejuízo das demais penalidades.

---

## 4. OBRIGAÇÕES SOBREVIVENTES AO TÉRMINO

O LICENCIADO permanece sujeito, mesmo após a data efetiva do término, às seguintes obrigações, pelos prazos respectivos:

| Obrigação | Prazo de sobrevivência | Base |
|-----------|-----------------------|------|
| **Confidencialidade** | 5 (cinco) anos contados da data efetiva | LICENÇA Art. 8.5 + 7.6(a) |
| **Penalidades e indenização** | Enquanto pendentes de quitação | LICENÇA Arts. 9 e 12 + 7.6(b) |
| **Sujeição à auditoria** | 2 (dois) anos contados da data efetiva | LICENÇA Art. 7.6(c) |
| **Legislação e foro** | Indefinidamente | LICENÇA Art. 20 + 7.6(d) |
| **Disposições de natureza sobrevivente** | Conforme a natureza | LICENÇA Art. 7.6(e) |

---

## 5. REVOGAÇÃO IMEDIATA DE CREDENCIAIS TÉCNICAS

Independentemente do cumprimento voluntário pelo LICENCIADO, o TITULAR procederá, desde a data efetiva do término, à:

- (a) Revogação imediata dos PATs emitidos (PAT-DEV e PAT-CI), com efeito em `npm install` em até 5 (cinco) minutos;
- (b) Remoção dos Usuários Autorizados como outside collaborators do repositório `TN-Figueiredo/tnf-ecosystem`;
- (c) Arquivamento do diretório `partners/[slug]/` em `partners/_archived/[slug]-terminated-[AAAA-MM-DD]/`;
- (d) Atualização do `registry.csv` interno, com status `terminated`.

---

## 6. MODELO DE DECLARAÇÃO DE DESTRUIÇÃO (a ser preenchido e devolvido pelo LICENCIADO)

```
DECLARAÇÃO FORMAL DE DESTRUIÇÃO DO SOFTWARE @tn-figueiredo/*

[Razão Social do LICENCIADO], CNPJ [CNPJ], neste ato representada por
[Nome do representante legal], CPF [CPF], na qualidade de [cargo], com
poderes suficientes conforme [instrumento societário], DECLARA, sob as
penas da lei, que:

1. Deu estrito e integral cumprimento às obrigações previstas no Artigo
   7.5 da LICENÇA PROPRIETÁRIA FIGUEIREDO TECHNOLOGY v1 e na Cláusula
   7.4 do Acordo Master.

2. Cessou todo e qualquer uso do Software @tn-figueiredo/* em [DATA
   EFETIVA DO TÉRMINO].

3. Destruiu, de forma irreversível, todas as cópias do Software em sua
   posse, guarda ou controle, incluindo: [enumerar ambientes — ex.:
   repositório Git local, workstations dos Usuários Autorizados,
   ambiente CI/CD, backups S3/B2, imagens Docker, containers em
   produção, etc.].

4. Revogou o acesso de todos os Usuários Autorizados e cancelou os
   PATs emitidos pelo TITULAR.

5. Tem plena ciência de que falsa declaração configura Violação
   Material sem Cura e crime previsto no Art. 299 do Código Penal
   (falsidade ideológica), além de ensejar aplicação das penalidades
   da LICENÇA.

Data de destruição efetiva: [AAAA-MM-DD]
Responsável técnico pela destruição: [Nome + CPF]
Local: [cidade]

________________________________________
[Nome do representante legal]
CPF: [CPF]
Cargo: [cargo]

Assinatura eletrônica nos termos da MP 2.200-2/2001 e Lei 14.063/2020.
```

---

## 7. CONSEQUÊNCIAS DO DESCUMPRIMENTO

O descumprimento de quaisquer obrigações previstas nos itens 3 e 4 acima sujeitará o LICENCIADO:

- (a) À **cláusula penal** do Artigo 9.1 da LICENÇA (10× Licença Comercial Equivalente anual OU R$ 50.000,00, o que for maior);
- (b) À **multa diária** do Artigo 9.2 (R$ 500,00/dia, cap R$ 100.000,00);
- (c) À **indenização por perdas e danos** (Artigo 9.3), cumulativa com a cláusula penal;
- (d) À **tutela de urgência** (Artigo 9.5), busca e apreensão, medidas cautelares;
- (e) À **execução específica** das obrigações (Artigo 9.6, CPC Art. 497);
- (f) Aos **encargos moratórios** (Artigo 9.4 — IPCA + juros 1% a.m. + multa 2%).

---

## 8. RESERVA DE DIREITOS

Esta notificação NÃO configura renúncia, quitação ou remissão, pelo TITULAR, de quaisquer direitos decorrentes do Acordo Master, da LICENÇA ou da legislação aplicável, ficando expressamente ressalvada a faculdade de exigência de:

- Cláusula penal e multas;
- Perdas e danos;
- Indenizações cabíveis;
- Medidas judiciais e extrajudiciais, inclusive criminais, se cabíveis.

---

## 9. CANAL OFICIAL DE RESPOSTA

Eventuais manifestações do LICENCIADO em resposta a esta notificação devem ser endereçadas a:

- **E-mail jurídico:** `juridico@figueiredotech.com.br`
- **Cópia:** `licensing@figueiredotech.com.br`
- **Referência:** nº desta notificação + CNPJ do LICENCIADO.

---

## 10. ASSINATURA DO TITULAR

`[Local]`, `[Data]`.

________________________________________
**FIGUEIREDO TECHNOLOGY LTDA.**
CNPJ: 44.243.373/0001-69
Representante: Thiago Figueiredo
Cargo: Sócio-Administrador
E-mail: `juridico@figueiredotech.com.br`

---

*Fim da notificação nº `TN-[AAAA]-[NNN]` — `[AAAA-MM-DD]`.*
