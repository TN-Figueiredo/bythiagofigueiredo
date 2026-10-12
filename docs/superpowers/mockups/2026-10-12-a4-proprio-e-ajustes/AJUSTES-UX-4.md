# Ajuste 4: bolinha de cliques e trocas de título e thumbnail (tela do vídeo próprio)

Data: 12/10/2026. Pedido do dono: "a bolinha fica verticalmente no percentual? quanto mais alto, maior o clique?" e "falta indicar mudança anterior e pós troca de título ou thumbnail".
Nada foi commitado. Só arquivos desta pasta.

## 1. Bolinha de cliques (problema 1)

Decisão: seguida a direção do controlador. A marca saiu de dentro da barra e foi para uma faixa própria sob as datas.

- Faixa sob o eixo de datas (retângulo `ic-strip`, fundo rebaixado, borda fina). Cada dia com clique tem um ponto, **todos na mesma linha**, e o número escrito logo abaixo. A altura do ponto não representa nada (a faixa deixa isso visível: é uma fileira, não um gráfico).
- Legenda: "cliques estimados do dia: o número na faixa sob as datas (a altura do ponto não mede nada)". O ⓘ dos gráficos (video e canal) diz a mesma coisa.
- Em tela estreita (390 px) os números que não cabem em todos os dias aparecem de N em N dias, alinhados às datas do eixo; os pontos continuam em todos os dias. A leitura completa segue pelo teclado, pelos botões e pela tabela.
- O halo das etiquetas de valor (`ic-val`) agora tem contorno da cor do fundo, para as marcas de troca não riscarem o número.

**Gráfico do canal** (`canal.html?caso=cheio`, já aprovado): também usava a bolinha, então recebeu a mesma faixa. Barra cheia, caixa vazada e hachura não mudaram. Mudou só: o ponto saiu da barra para a faixa, a legenda e o texto do ⓘ ("Bolinha e número embaixo" virou "Faixa sob as datas...").

## 2. Trocas de título e de thumbnail (problema 2)

### Marcas nos dois gráficos por dia (views e impressões/cliques)
- Linha vertical no dia da troca (atrás das barras) com marcador no alto: **losango azul = título, triângulo violeta = thumbnail**, com o número da troca dentro (1, 2...), que é a ordem em "Trocas deste vídeo". Cor estável + forma + número, nunca só cor. Cores novas, fora do par verde/âmbar de direção: `--tr-t` (azul) e `--tr-m` (violeta), hex literal nos dois temas, nenhum `color-mix()`.
- Legenda com os dois símbolos e um link "o número é a ordem em Trocas deste vídeo" (âncora `#trocas`).
- Teclado: o texto de leitura do dia (`fala`) ganha "Título trocado neste dia (troca 1)". Tabela: coluna nova "Troca" ("◆ título (1)", "▲ thumbnail (2)"), só aparece se há troca.
- O ⓘ de cada gráfico explica losango, triângulo e que a troca pode ter acontecido a qualquer hora do dia marcado.

### Bloco "Trocas deste vídeo" (novo, depois de "Impressões e cliques")
- Frase-resumo no topo ("2 trocas neste vídeo: a de título em 27/09 (1) e a de thumbnail em 02/10 (2). Antes × depois, na de título não dá para separar da variação normal; na de thumbnail a taxa de clique ficou mais alta.").
- Por troca: marcador, data, pastilha de leitura, o que mudou (título: Antes/Depois em duas linhas; thumbnail: duas miniaturas lado a lado) e a faixa antes × depois com intervalo de 95% (Wilson) numa régua compartilhada entre todas as trocas do bloco.
- Pastilhas: `▲ taxa subiu` (verde), `▼ taxa caiu` (âmbar/ocre), `≈ não dá para separar` (neutra, faixas se cruzam), `... ainda não dá para dizer` (neutra tracejada, poucas impressões). Verde e âmbar só quando as faixas não se cruzam; "quase se tocam" (folga menor que 0,4 ponto) vira texto.
- Regra de impressões: **menos de 100 de um lado = nenhuma faixa nem número**, só "só N impressões: sem faixa" e a frase "Ainda não dá para dizer". Janelas: até 7 dias de cada lado, parando na troca vizinha; o dia da troca fica de fora (tem as duas versões).
- ⓘ do bloco: método, limiar de 100, e "Não é teste A/B: o período muda junto... Para separar a capa do momento, use o A/B Lab". Não há prosa disso na tela.
- Faixa marcada "exemplo" (pastilha tracejada, como no resto da pasta). As miniaturas de exemplo são capas desenhadas em SVG (a pasta não tem a imagem antiga); no caso magro a capa "depois" é a real do vídeo.

### Estados
| Caso | O que aparece |
|---|---|
| `?caso=cheio` | 2 trocas (título 27/09: não dá para separar; thumbnail 02/10: taxa subiu 4,9% para 6,3%), marcas nos dois gráficos |
| `?caso=magro` | 1 troca de título (25/09, exemplo sobre o vídeo real), 1 e 9 impressões dos dois lados: "ainda não dá para dizer", sem faixa e sem eixo |
| `?caso=novo` | sem seção: uma linha ("Trocas deste vídeo: nenhuma. O vídeo foi publicado ontem...") sem cartão |
| `?caso=sem-dado` | a mesma linha, dizendo "sem leitura: a coleta ainda não rodou" (não afirma "nenhuma") |

## 3. Dado de troca no banco para vídeo do canal próprio

**Hoje não existe um registro de trocas pronto para vídeo próprio.**
- `competitor_video_versions` (`20261003000002_observatorio_versoes.sql`): campos `field` (title|thumb|desc), `value_text`, `value_hash`, `thumb_etag`, `thumb_dhash`, `thumb_blob_url` (guarda a imagem antiga), `first_seen_at`, `last_seen_at`, `window_start`, `precision` (min|6h|1d|first), `is_current`. É a tabela perfeita para o que o mockup mostra, mas é só de **competidores** (FK para `competitor_videos`).
- `load.ts` (linha ~334) diz expressamente que vídeo próprio "não tem registro diário nem versões": título vem como uma versão única e `thumbs: []`.
- Para vídeo próprio existe em tese: (a) `audit_log` com `before_data`/`after_data` do trigger `audit_youtube_videos_editorial` (migration `20260922000002`), que registra mudança de `title`, `thumbnail_url` e `thumbnail_hq_url` com autor e data, **desde 22/09/2026** e sem texto/imagem antigos fora do JSON; (b) `ab_tests` + `ab_test_variants` (`original_title`, `original_thumbnail_url`, `blob_url`, `started_at`, `completed_at`), só para trocas feitas pelo A/B Lab.
- Lacuna principal: a URL da thumbnail do YouTube (`i.ytimg.com/vi/<id>/...jpg`) tende a ser **a mesma depois de uma troca**, então o trigger só dispararia por URL se algo mudasse nela; `competitor_video_versions` resolve isso com `thumb_etag`/`thumb_dhash`. Não confirmei isso no código de sync. Trocas feitas fora do CMS (no YouTube Studio) só entram quando a sincronização trouxer o novo título/URL, com precisão de horas ou dias, não de minutos.
- Logo, para esta tela virar real é preciso uma coleta nova de versões do canal próprio (ou reaproveitar `competitor_video_versions` para o canal próprio), com `thumb_dhash`/etag e blob da imagem antiga. O mockup não assume nenhum dos dois: tudo no bloco é exemplo e está marcado.

## 4. Arquivos alterados

- `a4-comum.js`: `A.serieDia` (faixa de cliques, marcas de troca, legenda, tabela, `fala`); novos `A.MIN_IMP`, `A.veredito`, `A.topoTaxa`, `A.antesDepois`.
- `a4.css`: variáveis `--tr-t`, `--tr-m`, `--on-tr` (claro e escuro); estilos da faixa, marcas e do bloco `tr-*`; halo em `ic-val`.
- `video.js`: trocas, janelas antes/depois, `secTrocas`, capas de exemplo, ⓘ novos, nota da barra do mockup.
- `a4-dados.js`: trocas de exemplo (cheio e magro); no cheio a taxa de clique depois do dia 02/10 sobe (x1,4) só nas impressões do vídeo em destaque; o resto da semente é idêntico.
- `canal.js`: só o texto do ⓘ do gráfico de impressões do canal (bolinha vira faixa).
- Capturas: `ajuste-4-shots/` (cheio 1440 escuro: impressões e trocas; cheio 1440 claro: views; magro 1440 escuro: impressões e trocas; canal 1440 escuro; cheio 390 escuro: impressões; cheio 390 claro: trocas a e b; magro 390 claro: trocas; novo 390 escuro).

## 5. O que não conferi

- Navegador: Chrome (DevTools). Não conferi **Opera**, Safari nem Firefox. `clip-path` nos marcadores do bloco e nas legendas deve ser bem suportado, mas não testei.
- Sem rolagem horizontal verificada (scrollWidth = largura) em 390 px, cheio claro/escuro, magro claro, novo escuro e canal 1440. Não rodei todos os 4 casos x 2 temas x 2 larguras: faltam capturas de cheio 1440 claro no bloco de trocas, de novo em claro e de sem-dado.
- Contraste medido só a olho (azul e violeta com número escuro no escuro e branco no claro); não rodei ferramenta de contraste. Foco por teclado nas marcas: o gráfico mantém o foco único no grupo (como antes); as marcas não são focáveis uma a uma. Leitura por teclado testada por script (setas), não com leitor de tela.
- Não revisei com o `revisor-ux-senior`; este ajuste ainda precisa dessa passagem antes da aprovação do dono.
- A suposição sobre a URL da thumbnail (seção 3) e o início do registro em `audit_log` vêm das migrations; não consultei o banco de produção.
- Limiar de 100 impressões e janela de 7 dias são escolhas minhas para o mockup, não vieram de nenhuma regra do projeto; precisam de decisão do dono.
- Mensagem do console `Unsafe attempt to load URL ... file:` aparece só por abrir via `file://` (iframe interno do mockup); não vi outro erro.
