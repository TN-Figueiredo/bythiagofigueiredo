# Mockup M3 r2 (consertos da r1): lista "Sugestões (N)" (21/10)

Abrir: `open -a Opera index.html`. Seletor no topo: **Estado** (agrupado), **Tema** e **Largura** (1440 ou 390). A URL aceita `?estado=<chave>&tema=dark|light&largura=1440|390` (mesmo padrão do M2) e `&filtro=destino|parecido` no estado `quarenta`. Os botões funcionam: Dispensar abre os motivos, cada motivo grava, Cancelar e Esc fecham, ⓘ abre o método, o filtro filtra; a 390, tocar no texto da linha mostra "puxado por" e os vídeos seus. Dados sintéticos.

Base: S7 r3, M1 e M2 r2 (tokens, selos, faixas, `nm` "não medido", escala 4/8/12/16/24/32, Georgia nos títulos), copiados do M2 sem identidade nova. Novos só `--ln`/`--ln-line`/`--ln-bg` (o `--lado-n` da Naksu: `#D9C08F` escuro, `#6B5320` claro) e a régua. Nenhum `color-mix()`.

## r2: o que mudou (item da revisão r1 → conserto)
- **Naksu B1 (bloqueia), título do `vazio-sem-lugar` cortado a 390:** o contêiner usava a classe `nm` do selo (nowrap, 12 px, rosa). Agora `fam-nm`, só o ícone é rosa. Medido: o h3 quebra em 2 linhas (45 px) em `--text`.
- **Naksu C1, esqueleto:** `.skel` existe (bloco, `--skel`, pulso só com `prefers-reduced-motion:no-preference`); `sk-row` com a altura da linha real: 209 px a 1440 (real 207 a 227) e 259 px a 390 (real 259 a 305).
- **Naksu C2 + Logan C3, régua:** traço desenhado depois do marcador, 0 a 20, 2 px `--text` com contorno de 1 px `--surface`; trilha em `--btn-line` (≥ 3:1); o traço se chama "regra 5×" (também no `aria-label`). No ⓘ, "Limiar" virou "Para virar sugestão: vídeos de 2 canais acima do normal, ou um só acima de 5×".
- **Naksu C3, puxado por:** título e ", de canal" em partes próprias, cada uma com reticências; o canal não some. Aberta a 390, quebra normal.
- **Naksu C4, selo "vence em":** a 390 sai da linha do chip (que não quebra mais) e vai para baixo da régua.
- **Naksu C5, Dispensar:** a 1440 é botão de texto sublinhado, cor `--muted`, sem borda; o primário/contorno mantém a caixa.
- **Naksu C6, ⓘ:** logo depois da régua, antes do texto; o texto quebra no espaço dele (linha sem salto de 40 px).
- **Naksu C7 + Logan C1, 390:** a miniatura aparece na linha aberta; a linha recolhida mostra sempre os vídeos seus ("Nenhum vídeo seu sobre Vietnã", "2 vídeos seus sobre Japão", "Parecido com 1 vídeo seu", ou "não medido") e o botão "Detalhes ▾" (44 px, gira ao abrir) abre "puxado por" e miniatura; tocar no título também abre. A data do cálculo só aparece aberta. Custo: a linha recolhida passou de ~208 para ~259 px a 390 (Detalhes tem 44 px); Logan estimava +20.
- **Logan C2, botão e rótulo:** seguem `proprios_agora` (leitura de hoje), não a `acao` gravada: sem vídeo seu "Abrir o vídeo do concorrente"; com N, "Abrir seus N vídeos sobre Japão" / "Abrir seu vídeo sobre X" / "Abrir seus N vídeos parecidos"; `playlist` não muda; "não medido" cai no genérico "Abrir seus vídeos" (sem número a prometer). O destino é a lista de vídeos filtrada pelos ids de `proprios_agora`. No `quarenta`, a 10ª linha tem `acao=video_novo` gravada mas 1 vídeo seu hoje: o botão segue a contagem. **Emenda pendente na T8 da F2: ação derivada de `proprios_agora` na leitura** (Yannis confere).
- **Logan C4, filtro:** os contadores contam só as linhas abertas (mesma conta do N do cabeçalho); caem ao dispensar.
- **Logan S1:** o laranja vai para a primeira linha aberta ao gravar. **S2:** a 390, motivos a 16 px um do outro. **S3:** a 1440 o título é texto (sem parada de Tab); só a 390 ele abre. **S4:** a 390, `quarenta` mostra 10 e "Mostrar mais (30)" (`&mais=1` na URL). **S5:** "Não salvou “Lugar errado”" e "Tentar de novo “Lugar errado”".
- **Naksu S1:** chip de origem com raio de 4 px (o selo de aviso segue pílula). **S3:** miniatura que falhou em `--dim`/`--border-strong`, sem vermelho.
- Logan para a Naksu: `nao-salvou` a 390 sem o ⚠ sozinho; `.vz` com `min-height` de 120 px (sobravam ~90 px).
- **Não feito:** Naksu S2 (filtro fixo no topo): o `.stage` do mockup cria o contêiner de rolagem e o `sticky` não apareceria; fica para a tela real.

Reverificado com Playwright headless (68 estados-largura-tema, sem abrir o navegador do dono): sem erro de script nem "undefined"/"NaN"; `scrollWidth` 390 em todos; todo botão visível a 390 com 44 px ou mais; todo texto com fundo sólido ≥ 4,5:1; nenhuma fonte abaixo de 12 px; zero `color-mix()`. Capturas novas em `shots/` (17 estados × 2 temas × 2 larguras). Não verificado: Opera real, leitor de tela, aparelho real.

## Decisões aplicadas (direção r2 de Logan e Naksu + respostas de Phil, Yannis e Hanna)
- Uma lista, só `niche_signals` (`destino`, `parecido`); mesmo N do sino e do Cowork. Página própria; bloco no A/B Lab; botão em Competidores que nunca some (N "…" ao carregar, "?" no erro, nunca 0 falso).
- Topo: título + N tabular, "Calculado hoje às 07:02" + ⓘ, frase-resumo por modelo fixo (≤ 2 nomes + "+N"), uma faixa condicional (dados velhos, erro com lista antiga, itens do sino que saíram).
- Linha: chip com símbolo + palavra ("Destino esquentou" alfinete, "Concorrente bombou" chama), mesma cor `--ln` nos dois; motivo em 2 linhas; régua com um marcador (maior `mult`) e o traço do limiar (5×, de `REGRA_SINAIS`), "20×+" acima de 20; vídeos seus datados pelo cálculo (`proprios_agora`, Yannis P6), "não medido" quando não há `video_lugares`; idade só no ⓘ, "vence em N dias" só ≤ 3.
- Miniatura e título do vídeo que puxou: **entram no desenho base** (Yannis P1 = sim: `amostra.ts` na T8, fora do payload), com o "Miniatura indisponível" quando falha; a 390 ficam só ao tocar.
- Um primário por `acao`, rótulo fixo: `video_novo` "Abrir o vídeo do concorrente" (Hanna), `titulo_descricao` "Abrir seus vídeos", `playlist` "Abrir suas playlists". Laranja só na linha 1; as outras em contorno.
- Dispensar: 1440 botão a 24 px do primário; 390 ⋯ de 44 × 44 a 24 px. Motivos por tipo, 1:1 com o enum (Phil): destino Lugar errado / Não me interessa | Já fiz; parecido Não é parecido / Não me interessa | Já fiz. "Já fiz" grava `dispensado/ja_fiz`, nunca `feito`. Grava na hora, faixa 5 s, sem Desfazer (reabrir é F3, Yannis P4); rede caída devolve a linha com "Tentar de novo".
- Vazio: um contêiner, frase + um número só quando a chave de `contagens` existe (Phil P3); chave ausente vira "não medido". Textos do `nunca-calculado` são os três de `textoNuncaCalculado` (Yannis Q7); `sem-grupo` em três variantes por contagem (Phil).
- Filtro por origem só com N > 8, na URL. Sem "Anotar como pauta" (Hanna: backlog), sem tipo da F4, sem número de força, sem "Depois".

## Decidido pelo desenhista (Logan e Naksu revisam)
- **Famílias do vazio:** quatro ícones (✓ resolvido, ○ calmo, relógio "ainda não começou", ⚠ problema) + o selo `nm` para `sem-lugar`. Logan pedia três; Naksu, cinco. Fiquei com os quatro da Naksu sem família nova para lacuna (o `nm` já existe), porque "tudo respondido" e "dia calmo" pedem leituras diferentes.
- **Motivos como botões, não `radiogroup`:** cada um grava ao toque; rádio promete escolher e confirmar depois.
- **Bloco do A/B Lab mostra 3 linhas** e "Ver todas (N)" quando N > 3 (Naksu pedia 5 e "ver todas" só com N > 5): o bloco divide a tela com o resto do Lab.
- **A 390 o valor "8,4×" sobe para a linha do chip** e sai do lado da régua (evita repetir o número e mantém a linha recolhida perto de 200 px).
- **Frase-resumo em Georgia 21 px** (a `.sum` do M2), não 16 px/600: mesma família das outras telas.

## Pendente do dono
- **Bloco "Candidatos (fora da contagem)" com "Iniciar Lote" fica no A/B Lab, fora do N** (recomendação da Hanna). **Padrão: sim.** Desenhado em `ctx-ablab`; o lote em contorno, porque o laranja da tela é da linha 1.

## Estados (chave do seletor)
- Lista: `lista` (caso comum: 3, a 1ª sem vídeo seu), `um-item`, `quarenta` (filtro), `titulo-longo` (lugar e título longos, emoji, 48,3×, miniatura que falhou), `sem-video-proprio`, `alvos-nao-medido`, `info-aberto`.
- Dispensar: `dispensar-aberto`, `dispensada`, `ja-fiz`, `nao-salvou`.
- Leitura: `carregando`, `erro`, `erro-com-lista`, `desatualizado`, `sino-saiu`.
- Vazio: `vazio-tudo-respondido`, `vazio-nunca-calculado`, `vazio-nunca-antes7`, `vazio-nunca-desligado`, `vazio-sem-historico`, `vazio-sem-terceiro-outlier`, `vazio-abaixo-do-minimo`, `vazio-sem-lugar`, `vazio-sem-grupo`, `vazio-sem-grupo-um-canal`, `vazio-sem-grupo-ancora`, `vazio-sync-atrasado`, `vazio-sem-contagem`.
- Contexto: `ctx-ablab`, `ctx-ablab-velho`, `ctx-competidores`.

## Como testar no Opera
1. `lista` nos dois temas, em cinza: os dois chips se distinguem pelo símbolo e pela palavra? Só um laranja?
2. Dispensar → motivo → a faixa "Dispensada" aparece, N e frase caem, o foco vai à linha seguinte. Esc fecha os motivos e devolve o foco.
3. A 390: ⋯ abre os motivos; tocar no texto da linha mostra "puxado por" e os vídeos seus.
4. `quarenta`: filtre por Destinos e Concorrentes; a URL muda.
5. Percorra os vazios: cada um diz por que está vazio, e nenhum mostra 0 inventado.

## Medido (Playwright headless, 32 estados × 2 temas × 1440/390)
Nenhum erro de script; nenhum "undefined", "NaN" ou "null"; nada passa da borda e a página não rola para o lado a 390; todo botão visível a 390 com 44 px ou mais (exceto a caixa de seleção do lote, 20 px dentro de um rótulo de linha inteira); todo texto com fundo sólido ≥ 4,5:1 nos dois temas (texto sobre miniatura sintética não medido); nenhum texto abaixo de 12 px. Capturas de 16 estados em `shots/` (`<largura>-<tema>-<estado>.png`).

## Não verificado
Opera real (só Chromium headless); leitor de tela; deuteranopia `--ln` × `--warn`; aparelho real; rede lenta; o valor claro de `--ln` com o dono; nomes finais dos rótulos de primário com o produto.
