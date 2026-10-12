# Observatório, fase A5 (spec v2.2), parte 04: medidas, telas e mockups

> Parte do spec da A5 v2.2, dividido em 12/10/2026 só movendo texto (nenhuma frase mudou; a numeração de seções, etapas, migrations, perguntas e itens de aceite é a do original). Índice, cabeçalho "O que mudou" e tabela "onde está cada seção": [`../2026-10-12-observatorio-a5-concorrentes-design.md`](../2026-10-12-observatorio-a5-concorrentes-design.md).

## 5. Medidas derivadas (etapa E4): contas fixas sobre o que a Parte 1 grava

Regras comuns. (a) Toda medida devolve `{ estado: 'medido', valor, n, janela }` ou `{ estado: 'nao_medido', motivo, desde? }`; nunca nulo solto, nunca 0 por falta (o sistema "falha em verde"; seção 8). (b) Longos e Shorts nunca se misturam; ao vivo e estreia (`was_live`) ficam fora das medianas de M1, M2 e M7 e a tela diz quantos saíram. (c) Mínimo de amostra: `RULES.weakBase` (3) para mediana de canal, salvo dito. (d) Limiar de "igual": ±10%, o mesmo de "praticamente igual" [DONO]. (e) Toda medida é **cálculo nosso sobre dado público**, e o ⓘ diz isso (política III.E.4.h, seção 11.1). (f) Janela que cruza 24/08/2026 leva a marca "a contagem de views do YouTube mudou neste período". (g) Vídeo fora do ar e mantido para análise (4.5) continua nas medidas do tempo em que esteve no ar, e a tela diz quantos são. (h) Série que foi para o arquivo (9.2) responde "não medido: arquivado, no arquivo desde dd/mm", nunca buraco nem zero. As funções são puras, em `lib/medidas/`, com teste de borda para cada limiar.

| # | Medida | Definição exata | Janela | "Não medido" quando | Viés dito na tela |
|---|---|---|---|---|---|
| **M1** | **Views na idade N** (N = 1, 7, 30 dias) | views do vídeo no instante `publicação + N dias`, por interpolação linear entre as duas leituras vizinhas (`viewsAtAge`, `series.ts`). N = 1 usa as leituras das primeiras horas; N = 7 e 30, a série diária. Do canal: mediana entre os vídeos do formato publicados na janela | vídeo: fixa na idade; canal: publicados nos últimos 90 dias | vídeo publicado antes de 03/10/2026 ("a contagem diária começou em 03/10"); descoberto com mais de 24 h ("descoberto tarde"); leituras vizinhas a mais de 36 h (8 h para N = 1); idade menor que N ("fecha em dd/mm"); canal com menos de 3 vídeos medidos | interpolar entre leituras espaçadas subestima a subida inicial; o horário de publicação e o fim de semana pesam mais em N = 1 e 7 |
| **M2** | **Curva por idade** | para as idades 1, 2, 3, 5, 7, 14, 21 e 30 dias (e 60, 90 com a série diária ou semanal), a mediana de M1 entre os vídeos do canal medidos naquela idade; e a versão relativa: fração de V30 já alcançada em cada idade | publicados nos últimos 180 dias | ponto com menos de 3 vídeos (cada ponto escreve o seu `n`) | os pontos de idade alta só têm os vídeos mais velhos: a curva não é de um mesmo grupo |
| **M3** | **Direção do canal** (cada canal contra ele mesmo) | três leituras, mostradas com o nome: **(a) do canal inteiro:** views totais ganhas nos últimos 28 dias ÷ nos 28 anteriores (`competitor_channel_snapshots.view_count`); **(b) dos vídeos novos, acumulada:** mediana das views atuais dos longos publicados nos últimos 90 dias ÷ a dos 90 anteriores (a da Parte D do mockup); **(c) dos vídeos novos, justa:** o mesmo com V30 (M1) no lugar das views atuais. ▲ se ≥ +10%, ▼ se ≤ −10%, ＝ no meio | 28 × 28 dias (a); 90 × 90 dias (b, c) | (a) menos de 56 dias de registro, ou dia sem registro na borda; (b) menos de 3 longos em algum dos períodos; (c) idem com V30: **só existe a partir de abril de 2027** (180 dias de série desde 03/10/2026) | (a) inclui Shorts e vídeos apagados; antes de 19/10/2026 a janela cruza a mudança de contagem; (b) "descer pode ser só idade: os vídeos mais antigos tiveram mais tempo"; subir apesar disso é sinal forte; (c) sem viés de idade |
| **M4** | **Taxa de acerto** | fração dos longos publicados nos últimos 90 dias, com 7 dias ou mais, cujo múltiplo (motor atual, `multiplier.ts`) é ≥ 2 (`RULES.outlierMin`); ao lado, a de fracasso: múltiplo ≤ 0,5 | 90 dias | menos de 5 vídeos com múltiplo de base não fraca (`RULES.medianMinN`) | o múltiplo é contra a mediana do próprio canal: mede regularidade, não tamanho; não compara canais em valor absoluto. Sempre "3 de 12"; percentual só com 10 ou mais |
| **M5** | **O que mudou antes e depois de subir** | (i) efeito de troca: o do motor atual (`effect.ts`: 7 dias depois contra até 7 antes, comparado com os outros vídeos do canal), só para título e miniatura; (ii) **subida**: primeiro dia em que a taxa dos 7 dias seguintes é ≥ 2× a dos 7 anteriores **e** o ganho nesses 7 dias é ≥ 1.000 views [DONO]; para cada subida, a lista de todas as mudanças registradas nos 14 dias anteriores (título, miniatura, descrição, tags, categoria, duração, capítulos, entrada em playlist) | 14 dias antes da subida; 7 depois da troca | sem série diária nos 14 dias (vídeo em faixa semanal: "série semanal") ou antes de 03/10 | lista coincidências, **não afirma causa**; não vê o que acontece fora do YouTube nem o que o YouTube recomenda; mudanças simultâneas não se separam |
| **M6** | **Ritmo e regularidade** | por formato: publicações por semana em 13 semanas (existe, `cadence`); **intervalo mediano** entre publicações; **semanas com publicação** ("11 de 13"); **maior buraco** em 26 semanas, em dias | 13 e 26 semanas | menos de 4 publicações na janela (3 intervalos); canal ainda buscando vídeos ("ritmo parcial", já existe) | vídeo apagado some da conta nos dados anteriores à E1; estreia conta pela data de publicação |
| **M7** | **Engajamento por view** | por vídeo: (curtidas + comentários) ÷ views **na idade de 30 dias** (leitura do dia 30); sem ela, sobre o total de hoje para vídeos de até 90 dias (existe, `engagementOf`), rotulado "total de hoje". Do canal: mediana. Curtidas e comentários também separados | idade 30 dias; ou 90 dias | curtidas ocultas **e** comentários desligados; com só um ausente, mostra o outro, rotulado ("só curtidas: comentários desligados"); vídeo com menos de 100 views | a taxa cai com a idade (views tardias engajam menos); por isso a idade fixa |
| **M8** | **Estado do canal** | **ativo**; **parado**: dias desde a última publicação > maior entre 28 e 4× o intervalo mediano (M6); **em queda sustentada**: M3(a) ≤ −10% em três janelas de 28 dias seguidas; **fora do ar**: `channels.list` sem o canal em duas leituras seguidas (`missing_since`) | 112 dias para a queda | queda: menos de 112 dias de registro sem cruzar 24/08/2026 (**primeira leitura limpa em 14/12/2026**); parado: M6 não medido usa só o piso de 28 dias | canal sazonal parece parado; inscritos não entram (arredondados a 3 algarismos) |
| **M9** | **Cauda do vídeo** (pico × perene) | (views de hoje − V30) ÷ views de hoje, para vídeos com 90 dias ou mais e V30 medido; e "ainda rende": ganho dos últimos 28 dias ÷ V30 | idade ≥ 90 dias | sem V30 (todo vídeo publicado antes de 03/10/2026); série semanal com buraco | só existe para vídeos nascidos dentro da série: **a partir de janeiro de 2027** |
| **M10** | **Pico sem cauda** (leitura, **não número**; é um indício) | o vídeo recebe a leitura quando valem as **três** condições, cada uma contra o próprio canal e o mesmo formato: **(i) muitas views cedo:** V30 (M1) ≥ 2× a mediana de V30 do canal (`RULES.outlierMin`); **(ii) quase nada depois:** cauda (M9) ≤ metade da mediana de cauda do canal **e** "ainda rende" (M9) ≤ 2% [DONO]; **(iii) pouca reação:** engajamento por view na idade 30 (M7) ≤ metade da mediana do canal [DONO]. Resultado: `pico_sem_cauda`, `nao_e_o_caso`, ou não medido. Não há nota nem percentual: a tela mostra as três condições com os três números | idade ≥ 90 dias | falta V30 (todo vídeo publicado antes de 03/10/2026); V30 < 1.000 views; canal com menos de 5 vídeos do formato com V30 e 90 dias (`RULES.medianMinN`); curtidas ocultas **e** comentários desligados ("sem reação pública para comparar": a leitura **não** é dada só com duas condições); ao vivo ou estreia | o texto obrigatório abaixo; vídeo de notícia ou de data marcada tem pico sem cauda por natureza; vale para longos e Shorts separados, e Shorts quase sempre têm cauda curta (o limiar é relativo ao canal por isso) |

**Texto obrigatório de M10, em toda tela em que a leitura aparecer** (no corpo, não só no ⓘ): *"Indício, não medição. Este vídeo teve muitas views nos primeiros 30 dias, quase nenhuma depois, e pouca reação do público (curtidas e comentários). Isso costuma acontecer quando o YouTube para de recomendar um vídeo; essa é uma hipótese nossa sobre como a recomendação funciona, não um dado. O YouTube não mostra a ninguém de fora quanto tempo as pessoas assistiram ao vídeo de outro canal."* Nome de tela proposto, em português simples: **"Estourou e parou"**; alternativa mais cautelosa: **"Muitas views, pouco sinal de que agradou"** (o nome fecha no mockup 14; "pico sem cauda" é o nome interno). A palavra "retenção" não aparece. O oposto ("segue rendendo": cauda ≥ 2× a mediana do canal) é só o valor alto de M9, sem leitura própria. Os limiares são palpite inicial: o plano os confere contra os vídeos reais assim que houver 20 com V30 e 90 dias, e a mudança é um número em `rules.ts`.

**M1 gravada nas idades 1, 7 e 30 (regra nova da v2).** M1 era só cálculo na leitura; com o arquivamento da série (9.2) o cálculo deixaria de ser possível para vídeo antigo, e M3(c), M9 e M10 dependem de V30. Por isso a marca é **gravada uma vez, quando a idade fecha**, numa tabela pequena que nunca sai do banco online:

```sql
create table if not exists public.competitor_video_marks (        -- migration MG4
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  age_days smallint not null check (age_days in (1, 7, 30)),
  site_id uuid not null references public.sites(id) on delete cascade,
  views bigint not null,              -- interpolado, como M1
  likes bigint,                       -- nulo = oculto ou não medido
  comments bigint,                    -- nulo = desligado ou não medido
  gap_hours numeric not null,         -- distância entre as duas leituras usadas (a tela mostra)
  computed_at timestamptz not null default now(),
  primary key (video_id, age_days)
);
alter table public.competitor_video_marks enable row level security;
drop policy if exists "competitor_video_marks_select" on public.competitor_video_marks;
create policy "competitor_video_marks_select" on public.competitor_video_marks
  for select using (public.can_view_site(site_id));
```

Sem linha = não medido, com o motivo de M1 (a marca **não** é gravada com palpite quando as leituras vizinhas estão longe demais). Cerca de 300 linhas por canal por ano (0,03 MB). A função pura de M1 continua sendo a única conta; a tabela é o resultado dela guardado, e um teste afirma que a marca gravada é igual ao cálculo sobre a série enquanto a série existir. **O export de 9.2 recusa arquivar a série de um vídeo cuja idade 30 já fechou e que não tem marca nem motivo registrado.**

Datas em que cada medida passa a existir (a tela calcula; aqui, a ordem de grandeza): M1 N = 7 desde 10/10/2026 e N = 30 desde 02/11/2026 para os 39 vídeos publicados desde 03/10; N = 1 só para vídeos publicados depois do deploy da E2; M3(a) já (com a marca de contagem até 19/10); M3(b) já; M6 já; M4 já; M8 "parado" já, "queda" em 14/12/2026; M2 conforme M1; M9 em janeiro de 2027; M10 a partir de janeiro de 2027 para o primeiro vídeo e, no canal mediano (cerca de 5 longos a cada 90 dias), só por volta de abril de 2027, quando houver 5 vídeos com 90 dias; M3(c) em abril de 2027. Divergência registrada: a `REVISAO.md` diz que a direção "14 dias contra 14" existe em 17/10; a conta dá 31/10 (28 dias de série). Este spec usa M3(a), que já tem 133 dias de registro.

Nenhuma medida depende de dado que saiu da triagem (conferido linha a linha: usam contagens, datas, formato, versões e, em M5, playlists só se a E3 existir; sem ela, a linha "entrada em playlist" não aparece).

## 6. Parte 2: telas (etapa E5)

Regra do dono: **mockup antes de código, sempre com a skill `frontend-design`, e ele aprova o mockup de cada tela.** Este spec não desenha; lista o que cada mockup tem de considerar. Preferências dele, que valem como critério de reprovação: frase-resumo no topo de cada bloco; régua ou barra; cor estável, inclusive a de "não medido" (rosa com hachura, spec de telas 19.2); método no ⓘ; bloco monocromático ou em prosa é reprovado; nenhum `color-mix()`.

### 6.1 O que todo mockup desta fase considera (do inventário, seção 6)

1. **A tela nasce quase vazia.** Histórico de campo desde o deploy da E1; primeiras horas desde a E2; V30 de 39 vídeos em novembro. O estado vazio é o estado real por meses: é desenhado primeiro, com a data em que cada número passa a existir.
2. **Valor de agora × série.** O total de hoje (sempre existe) e o ponto da série (pode não existir) são coisas diferentes e têm rótulos diferentes.
3. **Vídeo fora da série diária:** "série semanal" é um estado com forma própria (ponto por semana, sem veredito de efeito), não um gráfico diário com buracos.
4. **Contagem oculta ou arredondada:** inscritos a 3 algarismos ("≈ 0, dentro do arredondamento"); inscritos ocultos; curtidas ocultas; comentários desligados.
5. **"Não medido" com motivo**, da lista fechada: contagem começou em 03/10; histórico de campo desde dd/mm; descoberto tarde; fecha em dd/mm; menos de N vídeos; série semanal; oculto pelo canal; não veio mais do YouTube; o YouTube não mostra isso de canal de terceiro; arquivado (no arquivo desde dd/mm); não coletada (a retenção do vídeo próprio antes da E8, ou vídeo com poucas views para o YouTube devolver curva).
6. **Comparável com o canal próprio ou não.** Do concorrente só existe o público. Views na idade N, ritmo, engajamento e direção são comparáveis **desde que do mesmo relógio**: o canal próprio entra pela série pública dele em `competitor_*` quando existir, nunca pelo diário privado (dia do YouTube, outra fonte). Retenção, impressões, taxa de clique, tráfego: só no cartão "Só o seu canal mede".
7. **Mudança de contagem de 24/08/2026:** linha de corte em toda série longa.
8. **1440 e 390 px, tema escuro e claro**, com a página no tamanho cheio e no magro.

### 6.2 Telas existentes: o que muda

| Tela | Já desenhado | Passa a poder mostrar | O mockup precisa considerar |
|---|---|---|---|
| **Comparar canais** (`C/_comparar/`) | Parte D: base de 90 dias × todos; direção; primeiros 7 e 30 dias; "Longos acompanhados" fora do ranking; Leitura rápida por direção | M3 nas três leituras; M1 com N = 1; M4; M7 na idade 30; M8 no cartão de cada lado | qual das três direções é a principal (proposta: (a) hoje, (c) quando existir) e como as outras aparecem sem virar três vereditos; canal de nichos diferentes; lado sem canal próprio |
| **Seletor de canal da comparação** | C1: combobox com busca | busca também por handle e país; "sem vídeos", "inscritos ocultos", "fora do ar" como pastilha | 75 ou mais canais; canal fora do ar não some da lista |
| **Lista de Canais e painel** | C2: descrição à parte da conta principal, com hábito | coluna Direção (M3a) e estado (M8); filtro "parados" e "em queda" | a conta "Trocas" segue título + miniatura; mudanças de campo novas ficam fora dela; a decisão D16 (cortar o painel) conflita com C2: o dono escolhe |
| **Página do canal** | não | aba ou bloco "Lançamentos" (6.3); cabeçalho com direção e estado; M6 completo; M4 | o cabeçalho já tem seis células: o que sai para entrar direção |
| **Histórico do vídeo** | não | curva do vídeo contra M2 do canal; primeiras 72 horas; marcas de mudança de campo no eixo; subida marcada com a lista de M5; "série semanal"; "sumiu em dd/mm" | o gráfico já tem raias de título e miniatura: quantas raias cabem antes de virar ruído |
| **Trocas / Mudanças** | não | filtro "outras mudanças" (tags, categoria, duração, formato), separado | não inflar a contagem da aba |
| **Outliers** | não | ordenar por V7 ou V30 na mesma idade, além do múltiplo; selo "ao vivo ou estreia" | quase tudo "não medido" até novembro: o padrão continua sendo o múltiplo |
| **Insights** | não | "quem sobe e quem desce no nicho" (régua de direção da Parte D, com todos os canais) | posição escrita, nunca percentil; a régua ordena, não julga |
| **Histórico do vídeo e Outliers: leitura "Estourou e parou" (M10)** | não | a leitura com as três condições e os três números, e o texto obrigatório da seção 5 no corpo | não pode parecer nota nem veredito: é indício; nunca a palavra "retenção"; quase tudo "não medido" até 2027; como aparece quando só duas condições valem (não aparece: mostra "não é o caso" com os números) |
| **Vídeo fora do ar** (em qualquer tela) | não | pastilha "saiu do YouTube em dd/mm" e, se respondido, "mantido para análise" | não some das listas; a série termina na data; o link para o YouTube deixa de existir |
| **Página do vídeo próprio: seção "Retenção"** (`C/_proprio/`) | sim, com **exemplo** (`video.html?caso=cheio`); o estado real de hoje é "não coletada" | a curva real (7.2): frase "metade das pessoas já saiu aos m:ss", maiores saídas marcadas, trechos revistos, comparação com vídeos de duração parecida | refazer **com o dado real** depois da primeira coleta: vídeo com poucas views (o YouTube devolve curva vazia ou serrilhada), Short (curva passa de 100%), vídeo de 2015, e a data da leitura sempre escrita |

| **Páginas do vídeo e do canal próprios: origem das views** (`C/_proprio/`) | não (hoje estão em "O que ainda não é medido") | 7.3: de onde vêm as views, o que pesquisaram e de que sites vieram, em que aparelho, de que país, inscritos e não inscritos; impressões por origem | a parte "omitido pelo YouTube" (a soma fica abaixo do total); canal com poucas views (quase tudo omitido); termos e sites **só para quem edita**; período longo (2015 a hoje) e a marca de mudança de contagem; país por mês na parte antiga, se a API não der por dia; o cartão "Só o seu canal mede" ganha linhas |

### 6.3 Telas novas que se justificam (três: duas dentro da página do canal e a fila do que saiu do YouTube)

1. **Lançamentos:** as curvas dos primeiros 30 dias dos vídeos recentes do canal, alinhadas pela idade, sobre a mediana do canal (M2). Responde P2 e P7 de relance ("este saiu acima do normal já no dia 2"). Sem ela, M1 e M2 só existem como número em tabela.
2. **Linha do tempo do canal:** um eixo de tempo com as views ganhas por dia do canal (M3a) e, sobre ele, publicações, mudanças de campo, trocas e playlists. Responde P3 ("o que ele mudou antes de subir") no nível do canal. Depende da E1 (e da E3 para playlists).
3. **Fila "Saíram do YouTube"** (4.5): uma aba do Observatório com contador. Lista os itens sem resposta, com o que se sabe de cada um e os dois botões; abaixo, os já respondidos ("mantidos", "apagados": só id e datas). O mockup considera: fila vazia (o estado normal); um canal inteiro fora do ar como um item só; a confirmação escrita de "apagar" com a contagem do que some; o estado "apagando" (miniaturas ou arquivo pendentes); "voltou ao ar"; e a frase fixa "o YouTube não diz o motivo".

Fase de manutenção, só registrada para o desenho não fechar a porta: **"Ver antigo"** (9.2), um botão nas telas de série que pede ao arquivo o período que já saiu do banco online.

Nenhuma tela para playlists sozinha.

### 6.4 Defeito em produção: o contêiner da comparação para no meio do monitor (T0)

**Sintoma relatado pelo dono:** na tela Comparar, o conteúdo é cortado em cerca de 925 px numa janela de cerca de 1.060 px; o documento mede 1.205 px de altura (1.931 de largura) e abaixo do corte o fundo é preto. **Hipótese não verificada:** o documento rola além do `main` da casca do CMS. Já descartado: o foco do `h1` usa `preventScroll`. **Exigência:** reproduzir em navegador (1440 × 1060 e 390 px, tema escuro e claro, página cheia e magra), medir `document.scrollingElement`, o `main` da casca e o contêiner da tela, e só então consertar; o conserto leva um teste e2e que falha no estado atual. Não depende de mockup nem de dado. Por decisão do dono de 12/10 os ajustes da A3 estão "só em planejamento": este item entra no plano e executa quando ele liberar (pergunta 4).

### 6.5 Etapa E13: fazer e validar os mockups (entre a coleta e o código de tela)

Pedido do dono (12/10): "preciso que você adicione uma etapa do spec para fazermos e validarmos o mockup". É uma etapa com entrega e itens de aceite próprios (98 a 106).

**(a) Quem faz.** Sempre a skill `frontend-design`, dentro da identidade já aprovada do Observatório (os tokens de `chrome.css` e `tokens-telas.css`, a rodada `2026-10-07-pagina-canal/` como referência). Nenhum mockup nasce fora dela, e nenhum usa `color-mix()`. Cada rodada entrega os arquivos em `docs/superpowers/mockups/<data>-<tema>/`, com `index.html`, `REVISAO.md` e as capturas em `shots/`.

**(b) A lista, na ordem de aprovação.**

*Já existem e aguardam aprovação* (`mockups/2026-10-12-a4-proprio-e-ajustes/`, itens 1 a 9 da `REVISAO.md`):

| # | Mockup | Abrir |
|---|---|---|
| 1 | Página do canal próprio com dado (cheio, magro, sem dado, canal novo) | `canal.html` |
| 2 | Gráfico: zero medido como caixa vazada e "dia anterior / dia seguinte" a 390 px | `canal.html?caso=cheio` |
| 3 | Página do vídeo próprio com dado | `video.html` |
| 4 | Taxa de clique com intervalo | `canal.html`, `video.html`, `comparar-so-seu-canal.html` |
| 5 | % assistido | `canal.html?caso=cheio&aba=retencao`, `video.html` |
| 6 | Retenção (curva de **exemplo**; estado real "não coletada") | `video.html?caso=cheio` |
| 7 | Seletor de canal com busca | `c1-seletor.html` |
| 8 | Troca de descrição na lista e no painel | `c2-trocas.html` |
| 9 | Comparar canais por base e direção | `comparar-direcao.html` |

*Faltam* (a ordem segue o que destrava código primeiro e onde o dado novo aparece antes):

| # | Mockup | Depende de dado de |
|---|---|---|
| 10 | **Fila "Saíram do YouTube"**, com a confirmação escrita do dono (6.3, item 3) | nada (a E1 enche a fila no segundo dia) |
| 11 | **Retenção do vídeo próprio com dado real** (refaz o item 6) | primeira leva da E8 |
| 12 | **Canal e vídeo próprios: origem de tráfego, termos de pesquisa, aparelho, país, inscritos** | retroação da E11 |
| 13 | **Histórico do vídeo de concorrente:** curva por idade (M2), **primeiras 72 horas**, marcas de mudança de campo, subida (M5), "série semanal", "saiu do YouTube" | E1 e E2 (uma semana de dado) |
| 14 | **A leitura M10** ("Estourou e parou"; nome alternativo a pesar no mockup: "Muitas views, pouco sinal de que agradou"), com o texto obrigatório | só exemplo até 2027: o mockup diz isso |
| 15 | **Página do canal de concorrente:** cabeçalho com direção e estado, Lançamentos, Linha do tempo | E1, E2 e E4 |
| 16 | **Lista de Canais:** direção, estado, filtros "parados" e "em queda", pastilha "fora do ar" | E4 |
| 17 | **Comparar (estados novos), Outliers e Insights:** M3(a), M4 e M8; ordenação por V7 e V30; selo "ao vivo ou estreia"; régua de direção do nicho | E4 |
| 18 | **O aviso de "banco chegando ao limite"** (9.2): verde, amarelo, vermelho, "sem leitura hoje", lotes exportados e não confirmados | E10 |
| 19 | **"Ver antigo" e o estado "arquivado": só esboço**, por serem da fase de manutenção; serve para as telas de série não fecharem a porta | nada |
| 20 | **Comentários de destaque do vídeo de concorrente** (emenda v2.1; o que considerar: 4.6.9): a amostra dita no topo, os três retratos por idade, a resposta do criador, os quatro estados sem comentário, texto longo, ofensivo, em outro idioma e com emoji, e os comentários que saíram do YouTube dentro da fila do mockup 10. **Fica logo depois do 13**, de que é uma seção; as perguntas 9 e 10 foram respondidas na v2.2, e o autor de destaque entra no desenho (4.6.9, ponto 9) | E14 (uma semana de dado: retratos de 1 e 7 dias) |
| 21 | **Ritmo por hora** (emenda v2.1; o que considerar: 4.7.8): o mapa de horas × dias, o perfil de 24 horas com a janela de pico, a comparação com o canal do dono, a curva de 72 horas; **caso magro: canal com quase nada** ("não medido: poucos vídeos recentes"), que é o caso real por meses. Só é levado ao dono depois da medição do item 140, que diz quais contadores podem ser mostrados | E15 (30 dias de leitura para o caso cheio com dado real; antes disso, exemplo marcado) |
| 22 | **"Perguntar a uma IA"** (emenda v2.2; o que considerar: 8.1.5): onde o botão fica em cada tela (uma posição só, a mesma em todas) a 1440 e a 390 px; o diálogo antes de copiar, com a prévia do texto, o tamanho, o que ficou de fora, o campo da pergunta, a marca "inclui dado privado do canal" e o aviso de que o texto sai do site; os estados "copiado", "falhou ao copiar" (com o baixar como saída) e "cortado por tamanho"; **caso magro:** tela quase toda em "não medido"; e a versão de quem não tem o direito de ver o dado privado (o diálogo diz o que não foi incluído, não é uma versão muda). Não depende de dado novo: pode ser desenhado sobre Comparar com os números reais de hoje | nada (os modelos de tela que já existem) |

**(c) O que cada mockup tem de mostrar para ser validável.** O **caso cheio e o caso magro com os números reais dos canais do dono** (os dois canais próprios e os concorrentes cadastrados); o **estado sem dado**; cada **"não medido" com o motivo** da lista fechada de 6.1.5; **1440 e 390 px**; **tema claro e escuro**; e, na tela e na `REVISAO.md`, **o que é dado real e o que é exemplo** (todo número de exemplo leva a marca "exemplo"). Mockup de dado que ainda não existe (M10, "Ver antigo") diz isso no topo. Valem os critérios de reprovação do começo desta seção (frase-resumo, régua ou barra, cor estável, método no ⓘ).

**(d) O rito de validação: dois crivos, o do revisor e o do dono.** Pedido do dono (12/10): "o frontend-design tem que ser cobrado. Quero um subagente senior frontend UX engineer que foca principalmente na experiência do usuário e em garantir que as cores estejam bem representadas e destacando a informação necessária". O revisor é o agente `revisor-ux-senior` (`~/.claude/agents/revisor-ux-senior.md`): não desenha nem edita, cobra, mede e devolve veredito.

| Passo | Quem | O que acontece |
|---|---|---|
| 1 | skill `frontend-design` | desenha o mockup, com tudo de (c) |
| 2 | `revisor-ux-senior` | abre o mockup **em navegador** (sobre `file://`), a 1440 e 390 px, nos dois temas, em cada estado; tira capturas, mede, e dá **veredito por tela**: *pronto para o dono*, *volta para ajuste* ou *reprovado*. Cada achado tem tela e estado, a evidência (medida, captura), a severidade (**bloqueia**, **corrige** ou **sugestão**) e o conserto em uma frase |
| 3 | skill `frontend-design` | corrige todo achado "bloqueia" e "corrige" |
| 4 | `revisor-ux-senior` | confere a correção e fecha cada achado, ou devolve de novo |
| 5 | **o dono** | só então abre o mockup e responde uma de três coisas: **aprova**, **pede ajuste** ou **reprova**. Ajuste pedido volta ao passo 1 e passa de novo pelo revisor |

- **O que o revisor julga** (os sete critérios da definição dele, nesta ordem): se a tela responde à pergunta de quem abre **no primeiro olhar** (em 3 segundos, sem rolar); se **a cor carrega informação**, uma cor com um significado só em toda tela, o que importa com o maior contraste e o secundário recuando, e cada estado (medido, zero medido, não medido, erro, subindo, descendo, indisponível) distinto por cor **e** por forma ou símbolo, legível em escala de cinza; hierarquia e densidade; texto de interface (nenhuma frase afirma mais do que o dado sustenta); estados e bordas (nulo nunca como zero); uso real (teclado, alvo de toque de 44 px, 390 px sem rolagem horizontal, os dois temas, movimento reduzido); coerência com o que já foi aprovado. As preferências registradas do dono valem como requisito.
- **A revisão fica em arquivo ao lado do mockup** (`REVISAO-UX.md` na pasta da rodada), com, por tela: a pergunta do usuário, o veredito, os achados por severidade e a **tabela de medidas**: contraste de texto e de elemento gráfico nos **dois temas**, com o número (mínimo de 4,5:1 para texto normal e 3:1 para texto grande e elemento gráfico), **alvos de toque**, e larguras e alturas a **390 px**. E, escrito, **o que o revisor não conseguiu verificar** (leitor de tela, um navegador específico), em vez de omitir.
- **Nenhum mockup vai ao dono com achado "bloqueia" ou "corrige" aberto.** "Sugestão" pode ir aberta, listada para ele.
- **Os nove mockups que já existem passam por esse crivo antes de serem levados à aprovação.**
- **Um por vez para o dono:** o mockup seguinte só é apresentado depois da resposta ao anterior (os que não dependem um do outro podem ser *feitos* e *revisados* em paralelo, não *aprovados* em lote). **Nenhuma tela vira código sem o mockup correspondente aprovado.** Cada resposta fica no ledger da fase com a data, o número do mockup e o veredito.
- **O mesmo revisor confere a tela implementada contra o mockup aprovado antes de a tela ir a produção** (em navegador, nos mesmos tamanhos e temas); divergência não declarada é achado "corrige".
- Custo: o revisor roda em Sonnet (é a definição dele) e é o único que abre navegador, como manda a regra de economia do projeto; as capturas ficam em arquivo.

**(e) O que não espera mockup** e pode ser planejado e executado antes: toda a coleta (E12, E1, E2, E3, E8 e E11, sem as telas), as medidas como modelo puro (E4), a dieta (E6), o export e o sinal no retorno do cron (E10), a parte de servidor da fila (E9), o Cowork (E7) e o conserto T0.

## Itens de aceite deste arquivo (blocos da seção 10 do spec, com a numeração original)

**E4: medidas**
27. Cada medida M1 a M9 tem função pura com testes de borda: exatamente no limiar (±10%, 3 vídeos, 2×, 1.000 views), amostra abaixo do mínimo, divisor zero (nunca `Infinity` nem `NaN`).
28. Banco sem nenhuma linha nova: toda medida devolve `nao_medido` com motivo (teste que **apaga** os dados, não que os substitui).
29. M1 de um vídeo com série completa confere, à mão, com as duas leituras vizinhas (três vídeos reais de produção, conta anotada no plano).
30. M3(a) dos 15 canais confere com `competitor_channel_snapshots` por consulta direta; janela que cruza 24/08/2026 sai marcada.
31. Vídeo com `was_live` não entra nas medianas de M1, M2 e M7, e o resultado diz quantos saíram.
32. Longos e Shorts nunca na mesma mediana (teste com canal misto).

**E5: telas**
33. T0: o defeito do contêiner reproduzido em navegador com medidas anotadas; teste e2e vermelho antes e verde depois; a 1440 e 390 px, nos dois temas, a página rola até o fim e não há faixa preta.
34. Cada tela só começa a ser codificada com o mockup correspondente aprovado (etapa E13, 6.5; itens 98 a 106).
35. Em cada tela, cada número novo tem base, janela e ⓘ com a conta e a frase "cálculo do Observatório sobre dados públicos do YouTube".
36. Cada tela foi vista em navegador nos estados: vazio (banco de antes da E1), parcial (uma semana de dado) e cheio (semente de um ano), a 1440 e 390 px, tema escuro e claro, sem rolagem horizontal e sem erro de console.
37. "Não medido" usa a cor e a forma únicas, e o motivo vem da lista fechada de 6.1.5; nenhum zero aparece onde a contagem é oculta ou ausente.
38. Seletor: digitar, setas, Enter, Esc e o canal indisponível funcionam por teclado; busca sem acento; itens de 44 px a 390 px.
39. A conta "Trocas" é igual na lista, no painel e na comparação; a descrição aparece à parte nos dois lugares.
40. `?base=` ausente dá a base de 90 dias (teste que apaga o parâmetro).
41. Usuário só de leitura não vê nada de `competitor_raw` no HTML nem no RSC.

**E4: marcas e M10**
54. Marca gravada = cálculo: para todo vídeo com série completa, `competitor_video_marks.views` é igual a M1 calculada sobre a série (teste); com leituras vizinhas além do limite, **nenhuma** linha é gravada e a medida responde o motivo.
55. M10: testes de borda das três condições (exatamente 2×, exatamente metade, exatamente 2%); com duas condições de três o resultado é `nao_e_o_caso`; com curtidas ocultas **e** comentários desligados é não medido; canal com 4 vídeos elegíveis é não medido; ao vivo e estreia ficam fora.

**E5: telas (acréscimos)**
56. Toda tela que mostra a leitura M10 traz o texto obrigatório da seção 5 **no corpo**; e nenhuma tela de concorrente contém a palavra "retenção" (teste sobre o HTML das telas de canal, vídeo, Outliers e Comparar de um concorrente).
57. Vídeo com `missing_since` não some de nenhuma lista: aparece com a pastilha, sem link para o YouTube, com a série terminando na data (teste e2e com a semente).

**E13: mockups**
98. Cada mockup da lista de 6.5 foi feito com a skill `frontend-design`, na identidade aprovada (tokens de `chrome.css` e `tokens-telas.css`; `grep` por `color-mix` nos arquivos do mockup = 0), e a pasta traz `index.html`, `REVISAO.md` e `shots/`.
99. Cada mockup mostra: caso cheio e caso magro **com os números reais dos canais do dono**, estado sem dado, "não medido" com motivo da lista fechada, 1440 e 390 px, tema claro e escuro (uma captura de cada em `shots/`); e a `REVISAO.md` diz, tela a tela, o que é dado real e o que é exemplo.
100. O ledger da fase tem uma linha por mockup com data e veredito do dono (aprovado, ajuste pedido, reprovado); nenhum mockup foi apresentado antes da resposta ao anterior.
103. **Nenhum mockup foi ao dono com achado "bloqueia" ou "corrige" aberto:** para cada mockup, a `REVISAO-UX.md` traz o veredito "pronto para o dono" em todas as telas, com data anterior à da apresentação.
104. A `REVISAO-UX.md` de cada rodada fica ao lado do mockup e traz, por tela, as medidas (contraste de texto e de elemento gráfico nos dois temas, com o número; alvos de toque; 390 px sem rolagem horizontal) e a lista do que o revisor **não** conseguiu verificar.
105. Os nove mockups de `2026-10-12-a4-proprio-e-ajustes/` passaram pelo revisor antes de serem levados ao dono.
106. Cada tela implementada foi conferida pelo `revisor-ux-senior` contra o mockup aprovado, em navegador, antes de ir a produção, e a conferência está registrada (divergência não declarada foi corrigida ou aceita pelo dono por escrito).
101. **Nenhuma tela virou código sem mockup aprovado:** cada tarefa de tela do plano cita a linha do ledger com a aprovação, e a revisão final da fase confere a lista de telas entregues contra o ledger (o T0 é a única exceção, por ser conserto).
102. O mockup do "Ver antigo" é um esboço marcado como tal, e nenhuma tarefa de código desta fase depende dele.
