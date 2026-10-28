# T6b v2 — portão de precisão do lugar (28/10) — APROVADO

Amostra: amostra-lugar-2026-10-28.csv (código v2 + semente v2; 96 outliers + 20 negativos; bruta intocada em amostra-lugar-v2-2026-10-28-bruta.csv). Mesmo critério da v1: rótulo pelo título (e bandeira emoji), `pais:XX` que o vídeo realmente trata, menção de passagem não conta. Rótulo em `chaves_corretas`; marcação por chave na coluna nova `marcacao` (certa/errada). Nota: o rotulador viu `chaves_calculadas` ao ler o CSV; os rótulos foram decididos pelo título, mas a independência não é total.

- Estrito: 75/80 chaves `pais:` = **0,9375** (Wilson 95%: **0,862–0,973**). Limite do portão (≥ 0,90) cumprido na estimativa; o limite inferior de Wilson fica em 0,86, abaixo de 0,90 (n = 80 é pequeno). Subiu de 0,598 (v1).
- Leniente: 75/80 = 0,9375 (igual; a amostra não tem lista "N países…" com chave nem Israel/Palestina juntos). Ver erro 5 se o dono quiser aceitá-lo.
- Negativos: 20/20 sem chave (ok). Os 96 outliers também não têm chave em listas ("5 Countries…", linhas 0, 3, 82, 83, 85) nem em títulos sem lugar (2, 5, 25, 28, 37, 42, 58, 65, 69, 73, 74, 94).
- Recall aproximado (só outliers): 75/78 = 0,96 (Wilson 0,89–0,99). Faltaram: TH em "Thai Gold" (linha 15), US em "America's 3 Strictest Religious Groups" (38) e US em "American Town" (45).

## Erros (5) por mecanismo
Padrão do canal (conserto v1 a/b): **0 erros de tag/descrição padrão** (Vietnã→TH/PH sumiu). Bandeira emoji agora entra (CN, PE, IT, KP certos).
1. Menção de passagem no título (4): BR em "O Brasil buga com isso? 🇻🇳" (linha 8, canal VN, fonte titulo); JP em "Japão em São Paulo" (22); RU em "36 Miles From Russia" (45); TH pela hashtag #thailand num vídeo sobre a Inglaterra (81, canal TH, fonte titulo). Mesmo mecanismo da v1: nome de país no título como referência, não como assunto.
2. Fonte `localizacao` sem lugar no título (1): "A4 Wagyu Katsu Sandwich" → JP/Osaka (52), fonte localizacao do canal Best Ever Food Review. Provavelmente verdadeiro no mundo real, errado pela regra do título; se aceito, 76/80 = 0,95.

## Veredito
**APROVADO** (estrita 0,9375 ≥ 0,90; Wilson inferior 0,862). Ressalva honesta: com 80 chaves o intervalo não exclui precisão real < 0,90.
Consertos opcionais, não bloqueiam (rodada seguinte, se o dono quiser subir o piso): (i) chave `pais:` por título entre "da/de/em/from/in + país" só conta se o país não for adjetivo/possessivo de outro lugar (ex.: "36 Miles From Russia", "Japão em São Paulo": quando o título já tem `local:` de outro país, o `pais:` do nome citado não entra); (ii) chave só de hashtag não entra se o canal já tem esse país como padrão (81); (iii) semente: "American Town"/"America's" → US, "Thai" → TH (recall).
