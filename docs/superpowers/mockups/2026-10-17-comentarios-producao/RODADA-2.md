# Rodada 2 do mockup dos comentários: achado -> onde foi resolvido

Gerador: `gen.py` (regenerado); estilos: `fio.css`. Variante B escolhida; a A ficou só na seção "Variante descartada" no fim de `video.html`.

| Achado | Onde |
|---|---|
| Logan 1: canal contradizia a si mesmo ("retrato de 30 dias") | `canal.html`: frase "Só 1 dos 14 vídeos dos últimos 90 dias já tem o retrato de 30 dias; o primeiro dos outros fecha em 14/11" (texto do Phil, t7-c2-phil.md); legenda na ordem da régua: "7 já tinham mais de 37 dias quando a coleta começou (15/10)", "1 com o retrato de 30 dias e resposta dele", "6 em coleta, ainda sem os 30 dias"; fios rotulados "no retrato de 30 dias" (o vídeo tem retrato de 30 dias real); aria-label da régua igual |
| Logan 2: quadro hostil "7 dias sem retrato" com aba aberta | `video.html`, quadro hostil: fio 9 agora "3 com 1 dia"; legenda do quadro sem a promessa de 5 respostas |
| Logan V7: barra 12/132 separada | `.resumo-linha` em `fio.css`: frase e barra "12 de 132" na mesma linha (quebra sob 390) |
| Logan: "9 de 12" | posições "1 de 12" a "12 de 12" em `video.html` |
| Logan: verbo único | JS: "Recolher" para texto e respostas |
| Logan: recuo a 390 | resposta em largura total mantida; fundo e borda distinguem (conferir com o Gio no navegador) |
| Naksu C1: selo A | A fora da página principal; só na seção descartada |
| Naksu C2: `.cf-meta.push` a 390 | `fio.css` @container: `.cf-meta.push{flex-basis:auto;margin-left:auto}` |
| Naksu C3: 11 -> 12 px | `.cf-av.sm .ini` e `.info i` em 12 px |
| Naksu: "Ver as outras 7" no vídeo | `video.html`: botão com 7 fios extras (posições 6 a 12 de 12) |
| Naksu: legenda do quadro hostil fiel | legendas distintas em `video.html` e `canal.html` |
| Régua: ⓘ | texto do ⓘ da régua pedido: "marco de 1 dia, relativa ao mais curtido da lista" (o botão ⓘ é só gráfico no mockup; texto vai para a implementação) |
| Não resolvido (produção) | `container-type` no `.sec`; thumb 64x36 com `loading="lazy"`; fonte do CMS no lugar da Inter; alvo do Gio: 390/481-700 renderizados |
