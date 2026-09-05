# Correção — perfil de cache não é paridade com o Next 15

**Data:** 2026-09-05. Aplicada antes de qualquer promoção para produção.

## O que estava errado

O WP-2 converteu as 172 chamadas de `revalidateTag` para a forma de dois argumentos
exigida pelo Next 16, escolhendo **perfis nomeados** por tag: 144 `'seconds'` e 28
`'minutes'`, zero `{ expire: 0 }`. A regra escrita tratava `{ expire: 0 }` como "a opção
para Route Handler" e os perfis como a escolha normal.

**Isso está invertido.** Medido em experimento reprodutível (`next build && next start`,
`next@16.3.4`, projeto isolado — ver `cache-staleness-probe.md`):

| Forma | 1ª leitura após invalidar | Rajada de 50 requests |
|---|---|---|
| `{ expire: 0 }` | **NOVO** (`x-nextjs-cache: MISS`) | 0/50 velhas |
| `'seconds'` | **VELHO** (`STALE`) | 46/50 velhas |
| `'minutes'` | **VELHO** (`STALE`) | 44/50 velhas |

Perfis nomeados definem `expired = agora + expire`, e enquanto não expira o Next **serve o
valor velho** e revalida em background. Vale também para o data cache, não só o de rota.
`'seconds'` = `expire 60`; `'minutes'` = `expire 3600`.

O `revalidateTag(tag)` de um argumento do Next 15 purgava na hora. **`{ expire: 0 }` é o
único equivalente.** Todo perfil nomeado é estritamente mais fraco.

## O que foi feito

As 172 chamadas passaram a `revalidateTag(tag, { expire: 0 })`, em 45 arquivos, mais os 32
asserts de teste em 18 arquivos e o wrapper de `lib/cms/admin.ts`. Uma regra só, sem
taxonomia: **paridade**.

## A regra daqui para frente

> Numa migração, `{ expire: 0 }` é o padrão — preserva o comportamento.
> Perfil nomeado é **otimização**, adotada tag a tag, por decisão consciente de produto
> (aceitar servir conteúdo velho por X em troca de menos carga), nunca por classificação
> automática e nunca de carona num bump de major.

Se um dia adotarmos perfis, o critério **não** é "quem lê a tag" — é "quanto de conteúdo
velho esta superfície tolera". As duas perguntas são diferentes, e o plano original
confundiu uma com a outra.

Cuidado extra: o aviso de depreciação do próprio Next sugere `'max'` como substituto do
argumento único. `'max'` é o perfil **mais fraco** (expira em um ano). Seguir a sugestão da
ferramenta teria piorado o defeito.

## Nota sobre o inventário de leitores

`leitores.md` e `orfas.txt` continuam válidos e úteis — a medição de quem lê cada tag está
correta e é o que permitiu quantificar o impacto (60 das 172 chamadas são em tags sem
leitor, logo o perfil delas nunca importou). O que foi descartado é a **regra de decisão**
que se apoiava neles.
