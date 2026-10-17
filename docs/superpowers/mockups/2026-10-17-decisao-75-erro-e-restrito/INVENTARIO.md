# Inventário da decisão 75: onde o código hoje mostra "não medido" (ou algo parecido) por erro ou por acesso negado

Base: `~/Workspace/wt-trem7` (origin/staging 365b60094). Caminhos relativos a `apps/web/src/app/cms/(authed)/youtube/competitors/`.
Mockup: `index.html` desta pasta. Só leitura; nenhum código de produto foi editado.

## 0. Peças comuns que mudam (uma vez, valem para todas as telas)

| Peça | Hoje | Depois |
|---|---|---|
| `_chrome/tokens-telas.css:11,16,22,24` `.obs-ch-nm` (rosa hachurado, texto e quadradinho `.nm-q/.so-nm/.ic-sw`) | única pastilha de ausência | fica só para "não medido" de verdade |
| `_chrome/medidas/medidas.css:15-16` `.obs-md-nc` + `_chrome/medidas/marcas.tsx:30-38` `NaoCarregou` | "Não carregou", contorno vermelho, sem símbolo, só no canal de fora | vira a pastilha **falhou** (triângulo + palavra); manter o botão "Tentar de novo" dentro dela |
| `_proprio/video-blocos.css:54` `.vb-falhou` (+ `video-blocos.tsx:114,132`) | "falhou" sem símbolo | usa a mesma pastilha nova; remover a classe local |
| (não existe) | `negado` sem pastilha ou como "não medido" | pastilha **restrito**: chapa lisa neutra + cadeado. Glifos já existem: `_proprio/origem-glifos.tsx` chaves `lock` e `aviso` |
| (novo) componentes `PastilhaErro`, `PastilhaRestrito` (+ versão quadradinho com `role="img"`) em `_chrome/` | | um módulo só; telas importam. `NaoCarregou` pode virar alias |

Tokens novos (literais, sem `color-mix`): `--danger-subtle`, `--danger-line`, `--res-bg`, `--res-line`, `--res-ink`, escuro e claro (valores no `index.html`, bloco `:root`). Contrastes medidos (Naksu, rodada 1): triângulo/contorno do erro 4,81:1 (escuro) e 5,41:1 (claro) sobre o fundo da pastilha; borda e cadeado do restrito 6,18:1 (escuro) e 7,13:1 (claro) sobre a superfície; texto do restrito 16,2 e 14,2. O 1,1 a 1,2 é só o preenchimento `--res-bg`, que é decoração; a borda NÃO foi mexida.

**Rótulo único (Logan R2):** a pastilha diz só `não medido`, `falhou`, `restrito`. As frases que hoje começam com "Não carregou:" (C5, C7, C10 e `abaNaoCarregou`) passam a "A leitura falhou:" no MESMO commit da troca do rótulo. Chaves internas `nao_carregou` podem ficar. O complemento ("teste A/B", "leitura") vai na frase, nunca na pastilha (T9).

**Botão "Tentar de novo" (F1/F2/F3):** fora da pastilha, um por bloco, `min-height:44px; padding:0 12px`. Só onde a tela já repete o bloco (canal de fora); nas demais, a frase diz "recarregue a página"; nunca as duas. Três estados: tentando (botão `aria-disabled` + `aria-busy`, largura fixa), falhou de novo (frase muda), deu certo (foco no valor, `aria-live=polite`). Avisos de lista com `role="status"` numa região só, nunca `role="alert"` por célula.

## A. Canal próprio (`_proprio/`, `_canal/` com canal próprio): onde `negado`/`erro` viram "não medido" HOJE

| # | Arquivo:linha | O que mostra hoje | Estado de origem |
|---|---|---|---|
| A1 | `_proprio/proprio-header.tsx:32` | quadradinho `.obs-ch-nm.nm-q` com `aria-label="não medido"` na faixa do cabeçalho | `negado`, `erro` (e sem-relatório, que fica "não medido") |
| A2 | `_proprio/header-model.ts:79-80,99-100,115-116,356-357,379-382` | frases `FRASE_NEGADO`/`FRASE_ERRO` e a fusão "só quem edita…"; o modelo não diz ao `Celula` qual forma usar | precisa expor `estado: 'negado' \| 'erro' \| 'nao_medido'` na célula |
| A3 | `_canal/video-card.tsx:35` (views), `:42` (impressões), `:24-26` `Nd` (múltiplo) | `.obs-ch-nm` com `v.viewsMissing`/`v.impMissing` ("só quem edita vê", "leitura falhou") | `negado`, `erro` |
| A4 | `_canal/video-card.tsx:59,63` | `v.viewsMissing`/`v.semMedida` em `.obs-ch-nm` (vídeo de fora; só "não medido", NÃO muda) | confirmar que não herda erro **Decisão:** fica "não medido"; exige teste de que `acesso:'erro'/'negado'` nunca chega neste ramo. |
| A5 | `_canal/tabela.tsx:60,98,107-110` (`Nm`) | impressões e cliques com `impMissing`/`cliquesMissing`; curtidas/comentários "não medido" (esses ficam) | `negado`, `erro` |
| A6 | `_proprio/videos-model.ts:88-95,131-135,144-149,164` | `palavraDaColuna`: `'só quem edita vê'`, `'leitura falhou'` vão para `impMissing`/`cliquesMissing`; `:149,164` `'não medido'` fica | **fonte**: trocar `string` por `{ estado, palavra }` |
| A7 | `_proprio/videos-model.ts:71-73,176-189` | `vpdDiarioMissing` e notas "Views por dia: só quem edita o site vê." / "…falhou agora" | `negado`, `erro` |
| A8 | `_proprio/reguas.tsx:154` | `<span class="obs-ch-nm">não medido</span>` quando `l.valor == null` | impressões sem alcance lido: `negado`, `erro`, sem-relatório |
| A9 | `_proprio/reguas-model.ts:151,277` | `motivoImpressoes`/`'impressões não medidas'` | precisa carregar o estado |
| A10 | `_proprio/assistido-periodo-model.ts:92-93,114-115,130` | `semNumero` = `'sem acesso'` / `'não conseguimos ler'` / `'não medido'` | `negado`, `erro` (e `acima-do-teto`, que fica) |
| A11 | `_proprio/assistido-periodos.tsx:58,148` | `.obs-ch-nm` com `c.semNumero` | idem |
| A12 | `_proprio/retencao-curva-model.ts:56-57,104` | `rotulo: 'não medido' \| 'falhou' \| null`; `negado: null` (sem pastilha) | `negado` ganha `'restrito'`; `erro` ganha o triângulo |
| A13 | `_proprio/video-blocos.tsx:114` | `r.rotulo === 'falhou' ? 'vb-falhou' : 'obs-ch-nm'` | idem |
| A14 | `_proprio/video-blocos.tsx:132` | nota privada: só `erro` tem `.vb-falhou`; `negado` sem pastilha | `negado` ganha restrito |
| A15 | `_proprio/video-blocos-model.ts:143-146,169,392-401,499-500` | `NOTA_NEGADO`/`NOTA_ERRO`, `acesso` já separado em `negado`/`erro` | já distingue; só a renderização falta |
| A16 | `_proprio/impressoes.tsx:199-200` | tabela do gráfico: `c.imp ?? <span class="obs-ch-nm">não medido</span>` (dia sem número) | **conferir**: se vier de `negado/erro` o bloco inteiro cai em `view.vazio`, então aqui é só "não medido" de dia **Decisão:** fica "não medido" (dia sem número); mesmo teste de A23. |
| A17 | `_proprio/impressoes.tsx:416` + `impressoes-model.ts:178-182,554` | `view.vazio` é `<p class="ic-vazio">` sem pastilha, para `SEM_PERMISSAO` e `ERRO_ALCANCE` | ganha pastilha restrito/falhou antes da frase |
| A18 | `_proprio/como-esta.tsx:93,126` + `como-esta-model.ts:98,129-130,155-156,187-188,234-235` | frases `pn-vazio`/`pn-fr` de negado/erro sem pastilha | idem |
| A19 | `_proprio/origem.tsx:141-148` + `origem-model.ts:531,540,555` | já tem seção "sem acesso" com `.ov-bq` e cadeado (`Você não vê este dado…`) | **referência do restrito**; alinhar o cadeado ao novo componente; sem mudança de texto |
| A20 | `_proprio/origem.tsx:92,123-124`, `origem.css:98,114,177` | `.ov-hach`, `.obs-ch-nm` em "não medido"/"—" | só "não medido": NÃO muda. Checar se algum `estado:'erro'` (`_comparar/so-seu-canal-model.ts:34`) chega aqui **Decisão:** fica "não medido"; mesmo teste de A23 sobre `so-seu-canal-model.ts:34`. |
| A21 | `_proprio/trocas-model.ts:117,121,124` + `trocas.css:10` + `trocas.tsx:10-11` | chip `leitura-falhou` é pílula tracejada com `!` (mesma família de "antes ainda não medido") | vira pastilha falhou; chips `*-nao-medido` ficam |
| A22 | `_proprio/trocas.tsx:59,73` + `trocas-model.ts:44,64,142,167,325` | `Teste A/B (sem acesso)` como texto (`.tr-sem-acesso`) e "Você não vê as trocas deste vídeo." | ganha pastilha restrito |
| A23 | `_proprio/dados.ts:39,110,143,179,215`, `dados-trocas.ts:49`, `dados-termos.ts:24,29`, `dados-origem.ts:71`, `carregar-extras.ts:37,62` | produtores de `{ acesso: 'negado' }`/`'erro'` | **sem mudança**: o estado já existe; só confirmar que nenhum caminho colapsa os dois em `null` **Condição dos casos A4/A16/A20:** teste de que nenhum caminho colapsa `negado`/`erro` em `null`. |
| A24 | `_proprio/view-model.ts:87-88,103`, `canal-agregados.ts:51-52`, `video-blocos-model.ts:522` | mapeiam `negado`→`sem-acesso`, `erro`→`leitura-falhou` | sem mudança; são a fonte para A10/A11 |

## B. Comparar (`_comparar/`)

| # | Arquivo:linha | O que mostra hoje |
|---|---|---|
| B1 | `_comparar/so-seu-canal.tsx:52` | `.obs-ch-nm.so-nm` na chamada quando `v.naoMedido` |
| B2 | `_comparar/so-seu-canal.tsx:62` | cadeado próprio `.so-cadeado` (SVG local, 12 px) por linha: vira o componente restrito |
| B3 | `_comparar/so-seu-canal.tsx:64` | `so-erro` (`<small role=alert>`, só texto): vira o componente falhou |
| B4 | `_comparar/so-seu-canal.tsx:72` | quadradinho `.obs-ch-nm.so-nm` para linha sem número (fica quando for "não medido") |
| B5 | `_comparar/so-seu-canal-model.ts:59-60,96-97,129-130,237,286-287` | `FRASE_NEGADO_CARTAO`/`FRASE_ERRO_CARTAO` via `semNumero(...)`: o cartão inteiro cai em `naoMedido` mesmo em negado/erro. **Fonte**: passar o estado |
| B6 | `_comparar/celulas-novas.tsx:27` | `case 'nao_medido'` com `.obs-ch-nm` + `c.porque` | só se `porque` vier de negado/erro (checar o modelo do número a número) **Decisão:** se `porque` vier de negado/erro, mostrar restrito/falhou. O modelo passa `estado` em TODA célula; o renderizador não decide pelo texto. |
| B7 | `_comparar/numero-a-numero.tsx:48-50` | `td.nd` com `.obs-ch-nm` "não medido" | idem B6 **Decisão:** idem B6 (célula negada hachurada contradiz a decisão 75). |
| B8 | `_comparar/leitura-rapida.tsx:21` | marca `.lr-s.nmk` com `.obs-ch-nm` | idem **Decisão:** idem B6. |
| B9 | `_comparar/comparar.css:58,93` | estilos de `.nmk`/`.nd .obs-ch-nm` | ajustar junto |

## C. Canal de fora e Canais (só erro; restrito não se aplica)

"Não carregou" já é erro com forma própria (`.obs-md-nc`), mas sem símbolo e com outro nome. Passa a **falhou**.

| # | Arquivo:linha |
|---|---|
| C1 | `_chrome/medidas/marcas.tsx:30-38` (componente) e `_chrome/medidas/medidas.css:15-16` |
| C2 | `_canal/medidas/celulas.tsx:17` (valor `nao_carregou` do cabeçalho de medidas) |
| C3 | `_canal/medidas/ritmo-bloco.tsx:41` |
| C4 | `_canal/medidas/direcao-bloco.tsx:44-49,117` |
| C5 | `_canal/medidas/criador-responde.tsx:24-36` e `criador-lista-model.ts:30,48` (frase "Não carregou:") |
| C6 | `_canal/medidas/lancamentos.tsx:109-113`, `horas-do-canal.tsx:41`, `linha-do-tempo.tsx:30,76` |
| C7 | `_canal/medidas/frase-do-topo.ts:95-96,137`, `ritmo-model.ts:134,196`, `criador-model.ts:113,133` (frases com o prefixo "Não carregou:") |
| C8 | `_canais/resumo-bloco.tsx:82` (usa `NaoCarregou`), `_canais/cells.tsx:281-284` (`DirecaoValor`: `nao_medido` com `d.curta`; conferir se algum motivo é de leitura) |
| C9 | `_canais/montar.ts:35-37` mapeia `sem-acesso`/`leitura-falhou` do VPD próprio na lista: a lista de Canais NÃO mostra restrito hoje (só o vpd); decidir se mostra **Decisão:** a lista de Canais MOSTRA restrito na coluna de views por dia do canal próprio; canal de fora segue só "não medido"/"falhou". |
| C10 | `_chrome/comentarios/model.ts:347` e `frases.ts:26` (`abaNaoCarregou`), `_historico/medidas/{idade,resumo,subida}-model.ts` (`nao_carregou`) | mesma palavra nas frases e abas |

**Nome decidido (Logan, rodada 1 de 17/10): "falhou".** Substitui "Não carregou" (C) no mesmo commit do rótulo (R2: frases "A leitura falhou:").

## D. Fora da tela

| # | Onde | Nota |
|---|---|---|
| D1 | `_contexto-ia/empacotar-*.ts` (`acessoPorCanal` em `empacotar-canal-proprio.ts:343`, `empacotar-comparar.ts:428`, `empacotar-canais.ts:498`, `index.ts:82`) | o pacote da IA já separa `negado`/`erro`; verificar se escreve "não medido" para os dois. Os rótulos novos entram na varredura de frases **Decisão:** o pacote da IA escreve "falhou" e "restrito" com as mesmas palavras; entram na varredura de frases; dado negado nunca lido como zero. |
| D2 | Testes que fixam texto ou classe | `grep -rln "obs-ch-nm\|obs-md-nc\|vb-falhou\|Não carregou\|sem acesso" apps/web/test apps/web/src --include='*.test.*'` para a lista exata; atualizar no MESMO commit |
| D3 | `docs/superpowers/mockups/ROTEIRO-DE-TESTE-E-MELHORIAS.md` | registrar o roteiro de teste da decisão 75 |

## E. Ordem sugerida para o plano de implementação

1. Componentes e tokens (seção 0) com teste de contraste, como `regua-css.test.ts`.
2. Fonte do estado: A6, A10, A12, B5 (os modelos que hoje devolvem só `string`).
3. Telas do canal próprio (A1 a A22), página do vídeo primeiro porque Retenção já tem 5 estados aprovados.
4. Comparar (B).
5. Canal de fora (C), só troca de componente.
6. Pacote da IA e testes (D).
