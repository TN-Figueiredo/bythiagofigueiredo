# Observatório de Competidores v2 — design

**Data:** 2026-10-02 · **Status:** mockups aprovados pelo dono (com 1 ajuste aplicado) · **Rota:** `/cms/youtube/competitors`
**Mockups (fonte de verdade visual):** `docs/superpowers/mockups/2026-10-02-observatorio/` — abrir com `python3 -m http.server` na pasta.
**Regras de texto e comportamento:** `CONVENCOES.md` da mesma pasta. Onde este spec e a CONVENCOES divergirem, vale a linha mais recente da CONVENCOES.

---

## 1. Objetivo

Trocar o observatório atual (cards com "Testar esta abordagem", "Abrir no Cowork", "Montar roteiro", 0 mudanças de thumbnail, descrição só como hash, outliers sem janela de tempo) por um instrumento honesto para decidir o próximo vídeo, título e thumbnail:

1. **Antes → depois** de título, thumbnail e descrição, com o efeito medido (observado vs esperado pela idade, n, faixa) e ressalvas.
2. **Histórico completo por vídeo**: todas as versões de título, thumbnail e descrição numa linha do tempo sobre a curva de views.
3. **Outliers com janelas de tempo** (0–30, 31–90, 91–180, 181–365 d, mais de 1 ano) e fases.
4. **A forja como centro de P&D**: pedidos de leitura por nicho e tipo, fila honesta, leituras congeladas com selo. Saem os botões legados de Cowork.
5. **Mais canais**: limite 75, destravável pelo admin em +25.

Regra-mãe (CLAUDE.md, seção forja): o sistema falha em verde. Toda tela pergunta primeiro "o que acontece quando o dado não existe?". Nenhum número inventado, nenhum sucesso fabricado.

## 2. Telas e fidelidade ao mockup

Cada tela abaixo tem um arquivo de mockup. A implementação é comparada lado a lado com ele (seção 9). A barra "Estados do mockup" no rodapé de cada arquivo lista os estados que a implementação precisa reproduzir. Ela NÃO vai para produção.

### 2.1 Moldura comum (`chrome.js`/`chrome.css` → componente de layout do observatório)
- Cabeçalho: título Fraunces, três ações (forja — contornada ou sólida conforme a tela —, "Sincronizar concorrentes", "Adicionar canal"), menu ⋯.
- Linha de frescor: "N canais em <nicho> · M no total · sincronizado há X · ⚠ K com problema · forja consultou às HH:MM · Horários em São Paulo". O popover lista os canais com `problemPhrase`.
- Abas com contagem: Canais, Mudanças, Outliers, Insights. Seletor de nicho Todos / Viagem / IA, persistido por usuário.
- Status da forja no cabeçalho, no formato único (CONVENCOES linha 218): "na fila · pedido 14:58", "trabalhando desde 14:45", "atrasado · pedido 14:33", "sem máquina desde 12:55", "nova tentativa · 15:05", "liberado pelo vigia · 15:05", "falhou às 14:21", "recusado às 14:56", "publicado às 14:50".
- Modos do botão da forja:
  - livre;
  - "Pedido em andamento" (desabilitado);
  - **ativo + nicho livre**: o botão pede o nicho ou tipo livre, e o ocupado aparece como status ATIVO, nunca como pílula terminal;
  - terminal (pílula).
- Compacto (container ≤ 860 px): abas e nicho numa linha, rótulo curto "Ler IA"/"Ler Viagem", cabeçalho com altura fixa.
- Drawer do pedido: coluna ≥ 1280 px, modal abaixo disso (foco preso, Esc devolve o foco). Diálogos ficam fora da área de conteúdo.
- O conteúdo começa a 16 px das abas em todas as telas. O primeiro filho não tem margem própria.

### 2.2 Canais (`canais.html`)
- Tabela por canal: Canal, Ritmo (uploads/semana, 13 sem), Views/dia, Outliers, Trocas, Crescimento, Sincronização. Cards como alternativa. Escala por mil inscritos ou absoluta. Longos/Shorts.
- Contador "N de 75 canais" (o seu canal não ocupa vaga). No limite, "Adicionar" fica desabilitado com "Sem vagas: remova um canal…". Duplicado é rejeitado com o nicho. Vagas nunca negativas (conserta o bug "-1 vagas").
- Drawer do canal com abas Trocas, Vídeos e Outliers. A sincronização usa `problemPhrase`, números "até o registro diário de DD/MM HH:MM" para canal parado e o bloco da forja do nicho do canal.
- Sincronizar: só canais ok viram "agora". O resultado diz "11 de 13 canais sincronizados agora; 2 com problema · Fora da rodada: Vou sem volta (buscando vídeos)".

### 2.3 Mudanças (`mudancas.html`)
- Herói por troca:
  - título antes/depois com diff (saiu, entrou, mudou de lugar, só maiúsculas/minúsculas, com texto para leitor de tela);
  - thumbnails A/B/C com período no ar;
  - descrição com diff por linha e filtro de UTM.
- Painel de efeito:
  - observado → esperado (faixa interquartil, n, faixa de idade, método) → efeito em pp inteiro → veredito (ganhou, perdeu, neutro, inconclusivo, aguardando) e "Não prova causa";
  - "Aguardando" usa `waitText`; sem base usa `noBaseText`;
  - quando o veredito é inconclusivo, o número fica rebaixado.
- Balanço (ledger):
  - mediana só com n ≥ 5; abaixo disso, contagem por veredito + faixa + "pouco para concluir";
  - fora das medianas, em grupos disjuntos que fecham a conta: reversões, com ressalva, inconclusivas por tipo, sem veredito.
- Filtros por janela (7/30/90 d), tipo, formato e busca, todos na URL. `?changes=` (lista citada pela forja) e `?reading=` (abre a leitura; nunca altera pedidos).

### 2.4 Outliers (`outliers.html`)
- Linha do tempo de idade: 0–30, 31–90, 91–180, 181–365, mais de 1 ano, Todos, com contagens. Grupos por fase: Estourando agora, Recentes, Perenes, Antigos, Novos (menos de 7 dias de série), Sem ritmo medido (só canal atrasado, com erro ou buscando).
- Multiplicador: "3,9× vs vídeos do canal com 31–90 dias (n = 9)", com método e fallback. Na borda da faixa ele diz a idade no registro ("este tinha 30 dias"). Base fraca fica fora da contagem.
- **Cards equivalentes com a mesma altura e largura na linha.** É o ajuste da aprovação: o card principal ocupa 2 colunas e acompanha a altura da linha, e o rodapé fica ancorado embaixo.
- O primeiro card cabe acima da dobra a 1440×900. Parâmetros inválidos viram chips removíveis. Todo botão de estado vazio mostra um N igual ao destino.

### 2.5 Insights (`insights.html`)
- Herói = leitura congelada da forja:
  - cada leitura com o próprio selo ("forja · Gemma 12B · temas, 90 dias · 20/10 06:10 (SP)") logo acima do texto LITERAL;
  - notas do site em "Do site", fora do selo;
  - "Desde então" vem do motor (shortText/text, ou textNoAsk com pedido em andamento).
- Fórmulas de título (passa a regra só com n ≥ 10 e Δ ≥ 0,3×), cadência por canal, heatmap dia × hora (uploads e multiplicador, empate e canal dominante), temas em alta, "Você no nicho" e Lacunas (só métricas relativas).
- Copiar texto da leitura: um bloco por fonte, com selo e dados enviados. Falha de cópia mostra o texto selecionável.

### 2.6 Histórico por vídeo (`historico-video.html`)
- Curva de views/dia em degraus com a esperada tracejada. Faixas de título, thumbnail e descrição com janelas de 6 h ou 1 dia e minuto exato quando há. O período anterior a 03/10 aparece comprimido.
- Versões com "pelo menos" quando o início ou o fim não foram observados. O particípio segue o tipo (título visto/trocado; thumbnail e descrição vista/trocada).
- Comparação antes/depois por troca, com escala e ressalvas. Paginador que refaz a lista de origem (`back=`, `ids=`).
- Pedido de leitura do vídeo; `blockedBy` quando outro vídeo do nicho está na fila, com link para ele.

## 3. Dados e backend (gap entre hoje e o mockup)

| # | Hoje | Necessário | Onde |
|---|---|---|---|
| D1 | Thumbnail comparada por URL, que é estável, então nunca detecta troca | Fingerprint pelo `ETag` de `i.ytimg.com` (HEAD) + arquivo da imagem por versão | `lib/youtube/competitor-sync.ts`, `ab-drift.ts` |
| D2 | Descrição só como `description_hash` | Guardar o texto de cada versão (com UTM separado) | migration + sync |
| D3 | `competitor_changes` podado após 90 dias pelo ab-watchdog | Manter o histórico (o histórico por vídeo depende disso); podar só snapshots granulares | watchdog |
| D4 | Snapshot diário | Sincronização a cada 6 h (janela de troca de 6 h); 1 registro diário de views por vídeo | cron |
| D5 | Cálculo de outlier triplicado (`page.tsx:398-433`, `services/competitors.ts:261-349`) | Uma função única: multiplicador por idade (mesmo dia de vida, ou faixa como fallback), fases, janelas | `lib/youtube/` |
| D6 | Insights em UTC rotulado como SP; "sexta" fixo; `vsYou` contra canal com 0 vídeos | Fuso America/Sao_Paulo em toda data; dia da semana calculado; estados vazios honestos | `insights/page.tsx` |
| D7 | Efeito de troca inexistente | Observado vs esperado (mediana e IQR de vídeos do canal na mesma idade), 7 dias depois, vereditos e ressalvas (`effect()` do mockup) | novo serviço |
| D8 | Limite 15 fixo (`page.tsx:29`, `actions.ts:29-34`); bug "-1 vagas" (`add-channel-modal.tsx:154`) | `competitor_channel_limit` por site (padrão 75); ação admin "+25"; o modal lê `slots` do servidor, sem subtrair duas vezes | settings + actions |
| D9 | Cron `sync-youtube?mode=competitors` sincroniza todos em série numa função de 300 s | Lotes com cursor (N canais por execução, por `last_sync` mais antigo) e backfill separado; 75 canais × 4 sync/dia ≈ 2,7 mil unidades da Data API | `api/cron/sync-youtube` |
| D10 | Fila da forja só com claim | Tipos (`padroes-titulo`, `temas`, `resumo-trocas`, `leitura-video`); alvo (nicho ou vídeo); fila global; estados do mockup; cota por nicho + tipo/dia (falha e recusa não contam) | `youtube_intelligence_tasks` + API pipeline + worker da forja |
| D11 | — | Leituras congeladas: texto literal, selo (modelo, data), `sent` (escopo enviado), evidências; "desde então" calculado no site | tabela de leituras |

O motor do mockup (`dados.js`, ~190 testes em `dados-teste.html`) é a especificação executável das regras D5, D7 e D10. Portar as funções e os testes, não reinventar.

**Forja (escrita é do dono):** mudanças no worker em `/opt/agente` são preparadas como comandos para o dono colar (CLAUDE.md). Orçamento acoplado (20 min claim < 25 min cron < 30 min watchdog): a fila global não pode aumentar o tempo de um pedido. Um pedido = um tipo × um alvo.

## 4. Regras de texto não negociáveis (resumo da CONVENCOES)
- Pontos percentuais sempre inteiros. Idade via `fmt.age` (dias inteiros, igual às faixas). Sinal de menos U+2212.
- Status da forja no formato da linha 218. "Sem máquina": "Seu pedido das HH:MM está na fila e roda quando a máquina voltar." (plural com Todos).
- Textos canônicos do motor, sem paráfrase: `problemPhrase`, `noBaseText`, `waitText`, `since.shortText`/`text`/`textNoAsk`, `statusLines`/`statusText`.
- Sob o selo da forja, só texto literal da leitura.
- "Desde então" com maiúscula, sem ponto, em linha própria. Canal parado: "até o registro diário de DD/MM HH:MM".
- Vocabulário: "vigia", "sincronização", "Testar e comparar (teste A/B do YouTube)", "Horários em São Paulo". A cor da forja é teal (#5CC3B2 escuro / #17695C claro), nunca laranja. Um único botão preenchido por vista.

## 5. Pedidos à forja (estado)
- **Um estado só por site**, não por tela: pedidos indexados por (tipo, alvo). Trocar de nicho ou de tela nunca cria nem apaga pedido.
- Com Todos, um pedido por nicho, na ordem de clique. Um pedido novo compõe com os existentes, nunca substitui.
- Pedidos de tipos diferentes no mesmo nicho são permitidos. Bloqueia o mesmo tipo no mesmo alvo e a cota usada.
- Canais com sincronização com problema ficam fora do escopo, e a tela diz por quê.

## 6. Fora de escopo
Instagram/outras redes; CTR e retenção de concorrentes (não há fonte); recomendação automática de título. "Criar ideia no pipeline" fica para depois (endpoint não existe).

## 7. Riscos
- Fingerprint por ETag pode mudar sem troca visual (CDN). Mitigação: confirmar por hash perceptual da imagem antes de registrar a troca.
- Mais chamadas HEAD em 75 canais × 50–200 vídeos. Mitigação: checar só vídeos com menos de 90 dias a cada 6 h; os antigos, 1×/dia.
- Retenção de histórico aumenta o banco. Mitigação: guardar versões (poucas) e não snapshots.

## 8. Pendências pós-implementação (lista do dono)
Auditoria de 02/10: segurança S1–S6 (Next RCE via npm audit, views expostas a anon, `authenticateRead` sem `requirePermission` em `lib/pipeline/helpers.ts:32-38`, …), CI, forja F1–F7. Priorizar depois da entrega.

## 9. Verificação de fidelidade (obrigatória por tela)
1. Rodar o mockup (`python3 -m http.server`) e a tela implementada lado a lado a 1440×900 e 768×1024, temas claro e escuro.
2. Para cada estado da barra "Estados do mockup", reproduzir na implementação (fixture ou seed) e comparar: texto idêntico (salvo dados reais), hierarquia, contagens e N do link = N do destino.
3. Portar as auditorias dos mockups (`auditMockup`, `__audit` de canais, `_audit/*` de outliers e histórico) como testes Vitest/Playwright: contraste AA, alvos ≥ 32 px, sem overflow a 768, nada de NaN/undefined/"há −", topo do conteúdo, cards equivalentes com a mesma altura.
4. Validação autenticada do `/cms` antes da promoção (`docs/ops/runbook-cms-e2e-local.md`).
