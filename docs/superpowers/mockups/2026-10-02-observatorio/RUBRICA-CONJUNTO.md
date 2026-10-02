# Rubrica — revisão do CONJUNTO (coerência entre as 6 telas)

Telas: moldura-forja.html, canais.html, mudancas.html, outliers.html, insights.html, historico-video.html — todas consomem dados.js (window.OBS).
Você NÃO revisa o design de cada tela isoladamente (há revisores por tela). Você revisa se o conjunto conta UMA história só.

## Roteiros obrigatórios (siga clicando de verdade, não só lendo código)
1. Vídeo-vitrine `matt-opus55`: abra em Canais (drawer Matt Wolfe), Mudanças (filtro channel/video), Outliers (se aparecer), Insights (evidências), Histórico (?video=matt-opus55). Views, publicação, títulos, thumbs, janelas, vereditos, multiplicador: idênticos?
2. Canal Paddy Doyle (atrasado) e Esq Unltd Daily (erro 404): o estado de sincronização e o "fica fora da forja" aparecem iguais em todas as telas?
3. Nicho global: mude para IA em uma tela; ao navegar pelas abas (links), o nicho persiste (localStorage obs-niche) e as contagens 6/10/6 aparecem iguais em todas?
4. Links: cada "Ver os N vídeos/trocas/outliers" e "Ver histórico do vídeo" abre a tela de destino já filtrada e o N do link = N exibido no destino. Teste ≥ 10 links de telas diferentes.
5. Forja: a mesma leitura (ex. padroes-titulo-ia-20-10) aparece com o mesmo selo, mesmos números e mesmo "Desde então" em Insights, Outliers e Moldura? Estados da fila (requestScenario) com os mesmos textos em todas?
6. Sistema visual: tokens, nomes de ações (CONVENCOES), cabeçalho/abas/barra de nicho/barra de estados do mockup, selo da forja, vocabulário ("vigia", "sincronização", "Horários em São Paulo") — iguais em todas?
7. Tema claro/escuro: alternar e navegar mantém o tema? (?theme= ou localStorage, consistente).

## Saída
NOTA DO CONJUNTO: n/100 (coerência de dados x/40, navegação e links x/25, forja x/15, sistema visual x/20)
DIVERGÊNCIAS: lista numerada — tela A vs tela B, o que diverge, valor em cada, correção (qual tela muda).
O QUE ESTÁ COERENTE (não mexer).
