# Mockup M2 r1: caminho do teste do YouTube (21/10)

Abrir: `open -a Opera index.html`. Seletor no topo: **Estado** (agrupado), **Tema** e **Largura** (1440 ou 390). A URL aceita `?estado=<chave>&tema=dark|light&largura=1440|390` (mesmo padrão do M1), e `&motivo=incompleta|ja_ha_teste|estado_mudou|sem_conexao` no estado `ficha-erro`. Os botões funcionam: o clique leva ao estado seguinte. Dados sintéticos.

Base: cartão S7 r3 (tokens, selos, faixas, escala 4/8/12/16/24/32, Georgia nos títulos), sem identidade nova. Novos só `--vc` (versão C, valores da Naksu r2) e `--err` (texto de erro com ⚠). Nenhum `color-mix()`; só hex/rgba literais.

## Decisões aplicadas
- Direção acordada por Logan e Naksu (r2). Divergências decididas pelo brief: a ficha é um **painel na própria página**, no lugar da linha (até 880 px, uma coluna), tela cheia a 390, sem modal sobre modal. "Prefiro outro caminho" **some** em Short, kids, 18+ e estreia/live. "Decidir depois" não existe.
- Dia 14 (decisão do CHECK 3): um botão por versão, original incluída ("A (original) ficou" → `venceu_original`; "B venceu" → `venceu_nova`), mais Ficou igual, Inconclusivo e Não vi. **Sem primário**, ordem fixa.
- Nosso teste rodando: o primário do estado é **Pausar e voltar a original** (2 toques); **Abrir no Studio só aparece depois da original restaurada** (spec §6, como Logan; a Naksu preferia o botão sempre habilitado). A faixa "Lab pausado" com a hora fica na ficha.
- Já iniciei: 2º toque com a consequência escrita na própria ficha; erros no mesmo lugar (incompleta, já há teste, estado mudou, sem conexão).
- Cor = um significado: âmbar ⏸ Lab pausado; verde ✓ ficou no ar ou registrado; azul-acinzentado tracejado ▶ em teste no Studio, sólido ● resultado pronto; rosa hachurado ? não medido ou formato não confirmado; cinza — sem volume; laranja só no único primário. Cada selo se lê em cinza pelo símbolo e pela palavra.
- Um primário por estado; linhas de contexto ao redor da ficha ficam esmaecidas e sem primário.

## Estados (chave do seletor)
- Lista: `lista` (os 9 estados de linha mais "Sem volume"), `lista-carregando`, `linha-outro`.
- Ficha: `ficha-carregando`, `ficha-so-original`, `ficha-duas`, `ficha-tres` (título de 100 caracteres com emoji, C em 854 × 480), `ficha-so-titulo`, `ficha-so-miniatura`, `ficha-imagem-falhou`, `ficha-salvando`, `ficha-offline`, `ficha-outro-aparelho`, `ficha-studio-aberto`, `ficha-ja-iniciei`, `ficha-registrada`, `ficha-erro`, `ficha-ainda-nao`, `ficha-detectado`, `ficha-nosso-rodando`, `ficha-pausar-confirma`, `ficha-restaurando`, `ficha-restaurar-falhou`, `ficha-restaurada`, `ficha-lembrete`, `ficha-13d`, `ficha-15d`.
- Detalhe: `s7-detectado` (cartão S7 estado 1, sem redesenho, rótulos do glossário).
- Dia 14: `d14-duas`, `d14-tres`, `d14-derivada`, `d14-respondido`, `d14-original`, `d14-tardia`, `d14-conflito`.
- Avisos: `sino`, `email`.

## Como testar no Opera
1. `lista` nos dois temas: cada selo se distingue sem cor? A linha do Short não tem "Prefiro outro caminho"? Clique em "Prefiro outro caminho" e volte.
2. "Testar no YouTube" abre a ficha no lugar da linha; Esc ou Fechar voltam à lista com o foco no botão.
3. Na ficha: troque Título · Miniatura · Os dois; Abrir no Studio → Já iniciei vira primário → 2º toque → registrado.
4. `ficha-nosso-rodando`: Pausar (2 toques) → restaurando; `ficha-restaurada` mantém a faixa âmbar com a hora.
5. 390: o rodapé fixo "Lembrar no computador" e, em `ficha-lembrete`, "Lembrete enviado em 21/10, 14:40".
6. Dia 14 a 390 com 3 versões: cartões empilhados, alvos de 44 px; clique numa versão e em "Mudar minha resposta".

## Medido (Playwright headless, 37 estados × 2 temas × 1440/390)
Nenhum erro de script; nenhum "undefined", "NaN" ou "null" no texto; nada passa da borda do quadro e a página não rola para o lado a 390; todos os botões visíveis a 390 com 44 px ou mais. Capturas dos 16 estados principais em `shots/` (`<largura>-<tema>-<estado>.png`).

## O que não entra
Opção por canal ("meu canal não tem"); "Desfazer" do Já iniciei; descartar ficha à mão; "Decidir depois"; modal de 900 px; primário ou "resposta provável" no dia 14; datas de salvamento na linha; "vencedor" para o teste do YouTube; número oficial do Studio, CTR, retenção; redesenho do S7 (D22); animação além do esqueleto.

## Não verificado
Rótulos e ordem reais do Teste e compare no Studio (inclusive se ele declara a original vencedora); Opera real (só Chromium headless); leitor de tela; deuteranopia entre `--vb` e `--vc` (por isso o chip sempre leva a letra); contraste de `--err` não medido; o âmbar do selo "Resolução baixa" é o componente do M1 (segundo significado do âmbar, previsto no glossário §5).
