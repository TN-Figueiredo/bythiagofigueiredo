# Integração NAS — Pipeline de Produção YouTube

> **Versão:** 2.0  
> **Data:** 2026-06-13  
> **Hardware:** Supermicro X11SCL-IF · Xeon E-2224G (4C/4T, 3.5 GHz, iGPU UHD P630 Quick Sync) · 32 GB ECC DDR4 · 2× Intel i210 1GbE  
> **SO:** TrueNAS SCALE 25.10.4 (Goldeye) · OpenZFS 2.3.4-1 · Linux 6.12 LTS  
> **Rede:** NAS 192.168.18.250 · IPMI 192.168.18.249 · Tailscale mesh VPN  
> **Canais:** PT @thiagonfigueiredo · EN @bythiagofigueiredo · 4K footage · 4 vídeos/semana  
> **Cenário crítico:** NAS na casa do irmão em SP. Owner mudando para Tailândia. Administração 100% remota via Tailscale. Irmão é o único respondente físico (não-técnico).

---

## Sumário

| # | Seção | Escopo |
|---|-------|--------|
| 1 | [Hardware & Topologia do Pool](#1-hardware--topologia-do-pool) | Pool atual (stripe → mirror → 2× mirror), ashift, autoexpand, SLOG/L2ARC |
| 2 | [Propriedades Globais do ZFS](#2-propriedades-globais-do-zfs) | atime, xattr, dnodesize, compression, autotrim |
| 3 | [Estrutura de Datasets](#3-estrutura-de-datasets) | 13 datasets, árvore de diretórios, tabela de tuning |
| 4 | [Racional de Tuning ZFS](#4-racional-de-tuning-zfs) | Justificativa técnica por dataset |
| 5 | [Comandos de Criação dos Datasets](#5-comandos-zfs-de-criação) | Copy-paste pronto para o shell, verificação |
| 6 | [Mapeamento Entidade do Pipeline → Dataset](#6-mapeamento-entidade-do-pipeline--dataset) | Cada tipo de arquivo → dataset de destino |
| 7 | [Workflow de Produção](#7-workflow-de-produção) | Naming, Resolve config, proxy workflow, etapas |
| 8 | [Permissões SMB e Segurança](#8-permissões-smb-e-segurança) | Usuários, matriz de acesso, hardening SMB |
| 9 | [Protocolo do Editor Remoto](#9-protocolo-do-editor-remoto) | Onboarding, SMB/Tailscale, latência, handoff |
| 10 | [Estratégia de Backup](#10-estratégia-de-backup) | Snapshots, Seagate 20TB, regra 3-2-1 |
| 11 | [Planejamento de Capacidade e Archival](#11-planejamento-de-capacidade-e-archival) | Projeção de uso, archival de vídeos antigos |
| 12 | [Monitoramento e Manutenção](#12-monitoramento-e-manutenção) | Scrub, SMART, alertas, rotina mensal |
| 13 | [Segurança e Hardening](#13-segurança-e-hardening) | SSH, firewall, Tailscale ACL, updates |
| 14 | [Disaster Recovery](#14-disaster-recovery) | Cenários de falha, procedimentos de recuperação |
| 15 | [Guia de Emergência do Irmão](#15-guia-de-emergência-do-irmão) | Instruções simplificadas para respondente físico |
| 16 | [Diagrama de Rede](#16-diagrama-de-rede) | Topologia completa (LAN, IPMI, Tailscale) |
| 17 | [Checklist Pré-Partida para Tailândia](#17-checklist-pré-partida-para-tailândia) | Tudo que precisa estar pronto antes de embarcar |
| 18 | [Administração do Tailscale](#18-administração-do-tailscale) | ACLs, key rotation, exit nodes, MagicDNS |
| 19 | [Baseline de Performance](#19-baseline-de-performance) | Benchmarks de referência para comparação futura |
| | [Regra de Ouro](#regra-de-ouro) | Princípio orientador de todas as decisões |

---

## 1. Hardware & Topologia do Pool

### Estado Atual — Stripe Único (temporário)

O pool `data` foi criado com um único NVMe Kingston NV3 4TB em stripe (sem redundância):

```
pool: data
  state: ONLINE
  config:
    NAME        STATE
    data        ONLINE
      nvme0n1p1 ONLINE     ← stripe único, zero tolerância a falha
```

**`ashift=12`** (setores de 4 KiB) — valor correto para todos os NVMe modernos. O TrueNAS detecta automaticamente, mas vale confirmar na criação: `zpool create -o ashift=12 data /dev/nvme0n1p1`.

**`autoexpand=on`** — habilitar agora para que o pool reconheça automaticamente discos maiores no futuro sem necessidade de `zpool online -e`:

```bash
zpool set autoexpand=on data
```

> **AVISO CRÍTICO:** Em stripe, qualquer falha do NVMe significa perda total dos dados. **Não ingira footage insubstituível antes de segunda-feira.** Mantenha tudo que importa no Seagate 20TB USB até o mirror estar ativo.

### Segunda-feira — Conversão para Mirror

Quando o segundo NVMe 4TB chegar, converter o stripe em mirror com um único comando:

```bash
# 1. Backup completo para o Seagate 20TB ANTES de qualquer mudança
zpool scrub data          # verificar integridade primeiro
zpool status data         # confirmar zero erros

# 2. Identificar o dispositivo atual
zpool status data         # anotar o nome (ex: nvme0n1p1)

# 3. Anexar o novo NVMe ao vdev existente (cria mirror)
zpool attach data nvme0n1p1 nvme1n1p1

# 4. Acompanhar o resilver
zpool status data         # mostra progresso do resilver
```

O `zpool attach` inicia um resilver (cópia completa dos dados para o novo disco). Com 4TB NVMe, espere ~2-4 horas. O pool permanece online e acessível durante o processo.

Topologia resultante:

```
pool: data
  state: ONLINE
  config:
    NAME          STATE
    data          ONLINE
      mirror-0    ONLINE
        nvme0n1p1 ONLINE
        nvme1n1p1 ONLINE     ← novo, resilvering
```

### Julho — Expansão com Segundo Mirror Vdev

Quando o PLX switch chegar e os dois NVMe adicionais estiverem disponíveis:

```bash
# Adicionar segundo mirror vdev ao pool (EXPANDE capacidade)
zpool add data mirror nvme2n1p1 nvme3n1p1
```

Topologia final:

```
pool: data
  state: ONLINE
  config:
    NAME          STATE
    data          ONLINE
      mirror-0    ONLINE       ← 4TB usáveis
        nvme0n1p1 ONLINE
        nvme1n1p1 ONLINE
      mirror-1    ONLINE       ← +4TB usáveis
        nvme2n1p1 ONLINE
        nvme3n1p1 ONLINE
```

**Capacidade:** ~8TB usáveis com redundância de 1 disco por vdev. Performance de leitura dobra (ZFS distribui reads entre os dois vdevs).

> **Nota:** SLOG (ZIL separado) e L2ARC são irrelevantes neste pool. O SLOG beneficia escritas síncronas em discos lentos — NVMe já tem latência de microsegundos. L2ARC é cache de leitura para compensar discos lentos — novamente, NVMe não precisa. Ambos consumiriam endurance do SSD sem benefício mensurável.

### Pool de Backup — Seagate 20TB USB

```
pool: backup
  state: ONLINE
  config:
    NAME        STATE
    backup      ONLINE
      sda1      ONLINE     ← Seagate 20TB USB 3.0
```

Pool secundário para backups offsite-ready. Throughput limitado pelo USB 3.0 (~400 MB/s teórico, ~200 MB/s real). Não usar para edição — latência e throughput incompatíveis com workflow interativo.

---

## 2. Propriedades Globais do ZFS

Configurar no nível do pool para que todos os datasets herdem automaticamente:

```bash
zfs set atime=off data
zfs set xattr=sa data
zfs set dnodesize=auto data
zfs set compression=lz4 data
zpool set autotrim=on data
```

> **`autotrim=on`** faz o ZFS enviar comandos TRIM ao NVMe automaticamente quando blocos são liberados. Sem isso, o SSD não sabe quais blocos estão livres, degradando performance de escrita e reduzindo a vida útil ao longo do tempo. Em pools 100% NVMe como este, é obrigatório.

| Propriedade | Valor | Por que |
|-------------|-------|---------|
| `atime=off` | Desliga atualização de access-time | Cada `read()` em um arquivo normalmente gera uma escrita de metadado atualizando o timestamp de último acesso. Para vídeo (leituras constantes durante edição), isso é ruído puro — elimina milhões de escritas desnecessárias por sessão. Datasets que precisam de atime (ex: `ingest`) fazem override individual. |
| `xattr=sa` | Extended attributes no dnode | Armazena xattrs diretamente dentro do dnode do arquivo em vez de criar blocos separados. Crítico para SMB — o protocolo SMB consulta xattrs (DOS attributes, ACLs, streams) em cada operação de diretório. Sem `sa`, cada `ls` em um diretório com 500 arquivos gera 500 seeks extras. |
| `dnodesize=auto` | Tamanho de dnode dinâmico | Permite que o ZFS aloque dnodes maiores que 512 bytes quando necessário. Pré-requisito para `xattr=sa` funcionar com atributos que excedem 512 bytes (comum em SMB com alternate data streams). Sem isso, xattrs grandes caem para o modo lento `xattr=dir`. |
| `compression=lz4` | Compressão LZ4 | LZ4 opera a ~4 GB/s em CPU moderna — mais rápido que qualquer storage. Mesmo em dados incompressíveis (H.264, H.265), o overhead é ~2% de CPU e zero de throughput. Em dados compressíveis (projetos, documentos, metadados), economiza 30-70% de espaço. Não há razão para desligar. |

---

## 3. Estrutura de Datasets

O pool é organizado em 13 datasets de primeiro nível (alguns com filhos), cada um com tuning ZFS específico para seu padrão de I/O.

```
data/
├── ingest/              ← Landing zone — dump direto dos cartões
├── production/          ← Projeto de vídeo em andamento
│   ├── raw/             ← Footage organizado (write-once, read-many)
│   ├── projects/        ← Arquivos .drp do DaVinci Resolve (SQLite!)
│   └── exports/         ← Exports finais renderizados
├── scratch/             ← Cache do Resolve, proxies, arquivos temporários
├── broll/               ← Biblioteca de B-roll por categoria
│   ├── tech-hardware/   ← Placas, cabos, componentes, unboxing
│   ├── tech-screens/    ← Screencasts, interfaces, código
│   ├── cityscape/       ← Cenas urbanas, trânsito, prédios
│   ├── lifestyle/       ← Cotidiano, café, workspace
│   ├── nature/          ← Paisagens, água, céu
│   ├── abstract/        ← Texturas, gradientes, padrões
│   ├── overlays/        ← Light leaks, glitch, film grain
│   └── people/          ← Interações, gestos, crowds
├── audio/               ← Efeitos sonoros e música
│   ├── sfx/             ← Sound effects por tipo
│   │   ├── whoosh/
│   │   ├── impact/
│   │   ├── ui/
│   │   ├── ambient/
│   │   ├── riser/
│   │   └── transition/
│   ├── music/           ← Trilhas por mood
│   │   ├── upbeat/
│   │   ├── chill/
│   │   ├── cinematic/
│   │   └── tense/
│   └── licenses/        ← Comprovantes de licença (Artlist, Epidemic, etc.)
├── graphics/            ← Thumbnails, brand assets, templates
│   ├── thumbnails/
│   │   ├── PT/
│   │   └── EN/
│   ├── templates/       ← Templates Photoshop/Figma
│   ├── brand/           ← Logos, paleta de cores, fontes
│   └── lower-thirds/    ← GFX de lower third para Resolve
├── photos/              ← Biblioteca de fotos (Immich)
├── media/               ← Filmes e séries (Plex/Jellyfin)
├── documents/           ← Documentos pessoais
├── backups/             ← Time Machine e backups gerais
└── apps/                ← Dados de containers (Immich DB, etc.)
```

### Tabela de Datasets

| Dataset | Propósito | Conteúdo típico | Acesso do Editor |
|---------|-----------|-----------------|------------------|
| `ingest` | Landing zone temporária | Dumps brutos dos cartões SD/NVMe das câmeras | Nenhum |
| `production/raw` | Footage organizado | .MOV, .MP4 originais das câmeras, organizados por código do vídeo | Leitura |
| `production/projects` | Projetos DaVinci Resolve | Arquivos .drp (bancos SQLite internos do Resolve) | Leitura/Escrita |
| `production/exports` | Exports finais | .MP4 renderizados em várias resoluções e formatos | Leitura |
| `scratch` | Cache e proxies | Proxies, cache de render, optimized media | Leitura/Escrita |
| `broll` | Biblioteca de B-roll | Clips de estoque organizados por categoria temática | Leitura |
| `audio` | Efeitos e música | WAV, FLAC, MP3 organizados por tipo + licenças | Leitura |
| `graphics` | Assets visuais | Thumbnails, templates PSD, logos, lower thirds | **Somente Leitura** |
| `photos` | Fotos pessoais | JPEG, HEIC, RAW — gerenciados pelo Immich | Nenhum |
| `media` | Streaming pessoal | Filmes, séries — gerenciados pelo Plex/Jellyfin | Nenhum |
| `documents` | Documentos | PDFs, planilhas, contratos | Nenhum |
| `backups` | Backups | Time Machine, snapshots exportados | Nenhum |
| `apps` | Containers | PostgreSQL do Immich, config do Plex, etc. | Nenhum |

**Notas:**

- **`graphics/` é somente leitura para o editor.** Thumbnails e brand assets são responsabilidade exclusiva do criador. O editor precisa acessar lower thirds e templates durante a edição, mas nunca deve modificá-los.
- **B-roll expandido para canal de tech/AI.** As 8 categorias refletem o conteúdo mais usado em vídeos de tecnologia: hardware em close-up, screencasts de interfaces, cenas urbanas para transições, e overlays para efeitos visuais.
- **Audio segue taxonomia da Artlist.** As subcategorias de SFX (whoosh, impact, ui, ambient, riser, transition) e music (upbeat, chill, cinematic, tense) espelham a organização dos principais marketplaces de áudio, facilitando o download direto para a pasta correta. A pasta `licenses/` guarda comprovantes de licença — essencial em caso de Content ID dispute no YouTube.

### Tabela de Propriedades ZFS por Dataset

| Dataset | `recordsize` | `compression` | `sync` | `atime` | `primarycache` | Extras |
|---------|-------------|---------------|--------|---------|---------------|--------|
| `ingest` | 1M | lz4 *(inherited)* | standard | **on + relatime** | all | `quota=200G` |
| `production` | 1M | lz4 *(inherited)* | standard | off *(inherited)* | all | — |
| `production/raw` | 1M *(inherited)* | lz4 *(inherited)* | standard | off *(inherited)* | all | `copies=2` (temporário, ver nota) |
| `production/projects` | **64K** | lz4 *(inherited)* | standard | off *(inherited)* | all | `copies=2` (temporário, ver nota) |
| `production/exports` | 1M *(inherited)* | lz4 *(inherited)* | standard | off *(inherited)* | all | — |
| `scratch` | 1M | lz4 *(inherited)* | **disabled** | off *(inherited)* | all | `quota=500G` |
| `broll` | **1M** | lz4 *(inherited)* | standard | off *(inherited)* | all | — |
| `audio` | 128K | lz4 *(inherited)* | standard | off *(inherited)* | all | — |
| `graphics` | 128K | lz4 *(inherited)* | standard | off *(inherited)* | all | — |
| `photos` | 128K | lz4 *(inherited)* | standard | off *(inherited)* | all | — |
| `media` | 1M | lz4 *(inherited)* | standard | off *(inherited)* | all | — |
| `documents` | 128K | lz4 *(inherited)* | standard | off *(inherited)* | all | — |
| `backups` | 1M | **zstd-7** | standard | off *(inherited)* | all | — |
| `apps` | **16K** | lz4 *(inherited)* | standard | off *(inherited)* | all | `copies=2` |

> **Nota sobre `copies=2`:** Em `production/raw`, `production/projects` e `apps`, `copies=2` é aplicado **temporariamente** enquanto o pool opera em stripe (sem redundância). O ZFS armazena duas cópias de cada bloco no mesmo dispositivo, protegendo contra bit rot localizado — não é substituto de mirror (um disco inteiro falhando perde ambas as cópias), mas reduz o risco em dados críticos. **Após converter para mirror (segunda-feira), remover:** `zfs set copies=1 data/production/raw data/production/projects`. Em `apps`, `copies=2` é **permanente** — configurações de containers (PostgreSQL do Immich, etc.) são difíceis de reconstruir e o custo de espaço é negligível (banco pequeno).

> **Nota sobre quotas:** `quota=500G` em `scratch` impede que o cache do Resolve cresça sem controle e consuma espaço do pool. `quota=200G` em `ingest` impede que dumps de cartões esquecidos acumulem. Ambos os valores podem ser ajustados conforme necessidade: `zfs set quota=600G data/scratch`.

---

## 4. Racional de Tuning ZFS

### `scratch` com lz4 e NÃO `compression=off`

Desligar compressão em NVMe parece intuitivo ("já é rápido"), mas é um erro. LZ4 opera a ~4 GB/s de throughput — mais rápido que qualquer NVMe consumer. O overhead real de CPU é ~2%, imperceptível no Xeon E-2224G. Em contrapartida, mesmo em dados parcialmente compressíveis (proxies H.264 com headers e metadados), LZ4 reduz escritas no NVMe em 10-30%. Isso traduz diretamente em maior vida útil do SSD e menos I/O no barramento. O resultado líquido é positivo em todos os cenários.

### `production/projects` com recordsize=64K

Arquivos `.drp` do DaVinci Resolve são bancos de dados SQLite internamente. O SQLite opera em páginas de 4 KB. Com `recordsize=1M` (o padrão para vídeo), cada escrita de uma página de 4 KB força o ZFS a fazer read-modify-write de um bloco inteiro de 1 MB — amplificação de escrita de **250x**. Ao reduzir para 64K, a amplificação cai para ~16x (ainda acima do ideal, mas o melhor balanço entre performance de escrita do SQLite e eficiência de leitura sequencial ao abrir o projeto). O efeito prático: Resolve salva projetos mais rápido, autosave gera menos I/O, e a latência percebida durante edição diminui.

### `broll` com 1M e NÃO 128K

B-roll são arquivos de vídeo — .MOV e .MP4 de 50 MB a 2 GB. O DaVinci Resolve lê esses arquivos sequencialmente dentro de cada clip, mesmo durante scrubbing (o codec precisa decodificar desde o último keyframe). 128K fragmentaria as leituras desnecessariamente, gerando mais operações de I/O para o mesmo throughput. 1M é o recordsize correto para qualquer arquivo de vídeo lido sequencialmente.

### `media` com primarycache=all (default)

Plex e Jellyfin fazem streaming sequencial — cada cliente lê o arquivo do início ao fim, uma vez. Os dados de vídeo em si raramente se beneficiam do ARC cache (lidos uma vez e descartados). Porém, usar `primarycache=metadata` é contraproducente: ele impede que **qualquer** dado entre no ARC, incluindo metadata de diretórios. Quando Plex faz library scan ou um usuário navega pela biblioteca, o servidor precisa stat centenas de arquivos — com `metadata`, essas operações de diretório são mais lentas do que precisam ser. O default `primarycache=all` deixa o ZFS decidir o que cachear via seu algoritmo ARC (LRU + LFU). Na prática, dados de vídeo sequencial são evicted rapidamente pelo ARC por terem baixa frequência de acesso, enquanto metadados frequentemente acessados permanecem. O resultado é o melhor dos dois mundos sem intervenção manual.

### `apps` com copies=2 (permanente)

O dataset `apps` contém dados de containers — principalmente o PostgreSQL do Immich e configurações do Plex. São bancos pequenos (tipicamente < 5 GB), mas cuja perda exige reconstrução manual completa (re-indexação de toda a biblioteca de fotos no Immich, re-scan de media no Plex, perda de watch history e metadata). `copies=2` armazena dois blocos de cada registro no mesmo dispositivo. O custo em espaço é irrelevante (~5 GB extras), e a proteção contra bit rot localizado é significativa. Diferente de `production/raw` e `production/projects`, aqui `copies=2` é **permanente** — mesmo após a conversão para mirror.

### `apps` com recordsize=16K

O PostgreSQL opera em páginas de 8 KB. `recordsize=16K` é o menor recordsize prático que acomoda uma página PostgreSQL com overhead mínimo. Recordsizes menores (8K) causam fragmentação excessiva em metadados ZFS; maiores (128K) causam write amplification desnecessária para escritas de 8 KB.

### Quotas em `scratch` e `ingest`

`scratch` armazena cache do Resolve, proxies e optimized media — dados regeneráveis mas que podem crescer indefinidamente. Sem quota, um projeto grande com Resolve gerando cache agressivamente pode encher o pool inteiro, impedindo escritas em datasets críticos como `production/projects`. A quota de 500 GB é generosa (suficiente para ~10 projetos simultâneos com cache completo) mas impõe um teto.

`ingest` é uma landing zone temporária. Dumps de cartões devem ser movidos para `production/raw/` após verificação. Sem quota, é fácil esquecer dumps antigos e acumular centenas de GB de footage duplicado. A quota de 200 GB comporta ~2 sessões completas de gravação (suficiente para o buffer) mas força limpeza regular.

---

## 5. Comandos ZFS de Criação

Executar na ordem. Copiar e colar bloco por bloco no shell do TrueNAS.

```bash
# ============================================================
# 1. Propriedades globais do pool (herdadas por todos os datasets)
# ============================================================
zfs set atime=off data
zfs set xattr=sa data
zfs set dnodesize=auto data
zfs set compression=lz4 data
zpool set autotrim=on data

# ============================================================
# 2. Criar datasets com overrides específicos
# ============================================================

# --- Ingest (landing zone com quota) ---
zfs create -o recordsize=1M -o atime=on -o relatime=on -o quota=200G data/ingest

# --- Production (pai + filhos) ---
zfs create -o recordsize=1M data/production
zfs create -o copies=2 data/production/raw         # herda 1M do pai; copies=2 temporário
zfs create -o recordsize=64K -o copies=2 data/production/projects
zfs create data/production/exports                  # herda 1M do pai

# NOTA: copies=2 em production/raw e production/projects é TEMPORÁRIO —
# mantém 2 cópias dos dados mais valiosos no mesmo disco enquanto o pool
# é stripe (sem redundância). Após converter para mirror (segunda-feira):
#   zfs set copies=1 data/production/raw
#   zfs set copies=1 data/production/projects

# --- Scratch (cache regenerável com quota) ---
zfs create -o recordsize=1M -o sync=disabled -o quota=500G data/scratch

# --- B-roll (vídeo = sequencial grande) ---
zfs create -o recordsize=1M data/broll

# --- Áudio (arquivos menores) ---
zfs create -o recordsize=128K data/audio

# --- Graphics (thumbnails, brand) ---
zfs create -o recordsize=128K data/graphics

# --- Photos (Immich) ---
zfs create -o recordsize=128K data/photos

# --- Media (Plex/Jellyfin) ---
zfs create -o recordsize=1M data/media

# --- Documents ---
zfs create -o recordsize=128K data/documents

# --- Backups (compressão forte, dados frios) ---
zfs create -o recordsize=1M -o compression=zstd-7 data/backups

# --- Apps (DBs de containers, copies=2 permanente) ---
zfs create -o recordsize=16K -o copies=2 data/apps

# ============================================================
# 3. Criar subdiretórios (não são datasets — apenas pastas)
# ============================================================

# B-roll por categoria
mkdir -p /mnt/data/broll/{tech-hardware,tech-screens,cityscape,lifestyle,nature,abstract,overlays,people}

# Áudio por tipo
mkdir -p /mnt/data/audio/sfx/{whoosh,impact,ui,ambient,riser,transition}
mkdir -p /mnt/data/audio/music/{upbeat,chill,cinematic,tense}
mkdir -p /mnt/data/audio/licenses

# Graphics
mkdir -p /mnt/data/graphics/thumbnails/{PT,EN}
mkdir -p /mnt/data/graphics/{templates,brand,lower-thirds}

# ============================================================
# 4. Verificar configuração final
# ============================================================
zfs list -o name,recordsize,compression,sync,atime,xattr,primarycache,quota,copies -r data
```

**Saída esperada do comando de verificação:**

```
NAME                     RECORDSIZE  COMPRESS  SYNC      ATIME  XATTR  PRIMARYCACHE  QUOTA   COPIES
data                     128K        lz4       standard  off    sa     all           none    1
data/apps                16K         lz4       standard  off    sa     all           none    2
data/audio               128K        lz4       standard  off    sa     all           none    1
data/backups             1M          zstd-7    standard  off    sa     all           none    1
data/broll               1M          lz4       standard  off    sa     all           none    1
data/documents           128K        lz4       standard  off    sa     all           none    1
data/graphics            128K        lz4       standard  off    sa     all           none    1
data/ingest              1M          lz4       standard  on     sa     all           200G    1
data/media               1M          lz4       standard  off    sa     all           none    1
data/photos              128K        lz4       standard  off    sa     all           none    1
data/production          1M          lz4       standard  off    sa     all           none    1
data/production/exports  1M          lz4       standard  off    sa     all           none    1
data/production/projects 64K         lz4       standard  off    sa     all           none    2
data/production/raw      1M          lz4       standard  off    sa     all           none    2
data/scratch             1M          lz4       disabled  off    sa     all           500G    1
```

> **Nota:** O `recordsize` do pool raiz (`data`) aparece como 128K — este é o default do ZFS e não afeta nada porque dados nunca são escritos diretamente no dataset raiz. Todos os datasets filhos têm seus recordsizes explícitos.

> **Nota:** `copies=2` aparece em `production/raw`, `production/projects` e `apps`. Os dois primeiros devem ser reduzidos para `copies=1` após conversão para mirror. `apps` permanece com `copies=2` permanentemente.

---

## 6. Mapeamento Entidade do Pipeline → Dataset

Cada tipo de arquivo do pipeline de produção tem um destino definido no pool. Esta tabela elimina ambiguidade sobre onde cada coisa vai.

| Entidade | Formato típico | Dataset de destino | Observação |
|----------|---------------|--------------------|------------|
| Dump bruto do cartão | Pasta com .MOV/.MP4 | `data/ingest/{data}_{camera}/` | Temporário — mover para raw após verificação. Quota: 200 GB. |
| Footage organizado | .MOV, .MP4 (4K) | `data/production/raw/{código}/` | Write-once. Nunca editar no lugar. |
| Projeto DaVinci Resolve | .drp | `data/production/projects/{código}/` | SQLite interno. recordsize=64K. |
| Proxy de edição | .MP4 (720p/1080p H.264) | `data/scratch/{código}/proxies/` | Regenerável. Limpar após export. |
| Cache de render | .dpx, .exr | `data/scratch/{código}/cache/` | Gerado pelo Resolve. Descartável. |
| Optimized media | .mov | `data/scratch/{código}/optimized/` | Gerado pelo Resolve. Descartável. |
| Export final | .MP4 (4K/1080p) | `data/production/exports/{código}/` | Versionado (v1, v2...). |
| Clip de B-roll | .MOV, .MP4 | `data/broll/{categoria}/` | Somente leitura para editor. |
| Efeito sonoro | .WAV, .MP3 | `data/audio/sfx/{tipo}/` | Somente leitura para editor. |
| Trilha musical | .WAV, .FLAC | `data/audio/music/{mood}/` | Somente leitura para editor. |
| Licença de áudio | .PDF, .PNG | `data/audio/licenses/` | Comprovante para disputes de Content ID. |
| Thumbnail | .PSD, .PNG | `data/graphics/thumbnails/{canal}/{código}/` | Somente leitura para editor. |
| Template gráfico | .PSD, .AI, .FIGMA | `data/graphics/templates/` | Somente leitura para editor. |
| Lower third | .PNG, .MOV (alpha) | `data/graphics/lower-thirds/` | Somente leitura para editor. |
| Logo/brand asset | .SVG, .PNG, .AI | `data/graphics/brand/` | Somente leitura para editor. |
| Foto pessoal | .JPEG, .HEIC, .RAW | `data/photos/` | Gerenciado pelo Immich. |
| Filme/série | .MKV, .MP4 | `data/media/` | Gerenciado pelo Plex/Jellyfin. |
| Documento | .PDF, .XLSX | `data/documents/` | Sem acesso do editor. |
| Backup Time Machine | .sparsebundle | `data/backups/` | Sem acesso do editor. |
| Dados de container | PostgreSQL, config | `data/apps/{container}/` | Sem acesso do editor. copies=2 permanente. |

> **Regra absoluta:** Proxies, cache de render e optimized media vão **sempre** para `scratch/{código}/`. Nunca armazenar dados regeneráveis dentro de `production/` — polui backups e consome espaço em dados que precisam de retenção longa.

---

## 7. Workflow de Produção

### Visão Geral do Pipeline

```
  ┌─────────┐     ┌─────────┐     ┌──────────┐     ┌──────────────┐     ┌───────────┐
  │ GRAVAR  │────▶│ INGEST  │────▶│ VERIFICAR│────▶│  ORGANIZAR   │────▶│  EDITAR   │
  │ câmera  │     │ cartão  │     │ checksum │     │  footage     │     │  Resolve  │
  └─────────┘     │ → NAS   │     │ md5/sha  │     │  raw/{code}/ │     │           │
                  └─────────┘     └──────────┘     └──────────────┘     └─────┬─────┘
                                                                               │
                  ┌─────────┐     ┌──────────────┐                            │
                  │ PUBLICAR│◀────│   EXPORT     │◀───────────────────────────┘
                  │ YouTube │     │ exports/{code}│
                  └─────────┘     └──────────────┘
                                        │
                                  ┌─────▼──────┐
                                  │  THUMBNAIL  │
                                  │ graphics/   │
                                  └────────────┘
```

> **A etapa VERIFICAR é obrigatória.** Só formatar o cartão da câmera após confirmação de checksum. Footage perdido é irrecuperável.

**Recursos utilizados durante edição:**

```
  production/raw/{code}/       ← footage (R/O)
  production/projects/{code}/  ← projeto Resolve (R/W)
  scratch/{code}/              ← proxies + cache (R/W, descartável)
  broll/*                      ← B-roll (R/O)
  audio/*                      ← SFX + música (R/O)
  graphics/lower-thirds/       ← GFX (R/O)
```

### 7a. Convenção de Nomes

Cada vídeo recebe um código único que é usado em todo o pipeline — do ingest ao export:

| Canal | Formato | Exemplo |
|-------|---------|---------|
| PT (@thiagonfigueiredo) | `PT-YYYYMM-NNN` | `PT-202606-047` |
| EN (@bythiagofigueiredo) | `EN-YYYYMM-NNN` | `EN-202606-023` |
| Cross-post | Sufixo `-xpost` | `EN-202606-023-xpost` |

- **Prefixo do canal** elimina ambiguidade em qualquer diretório.
- **Ano-mês** agrupa naturalmente e permite ordenação cronológica.
- **Contador sequencial** (`NNN`) é mantido no CMS. Reinicia por mês se preferir, ou é contínuo — a combinação `canal + ano-mês` já é única.
- **`-xpost`** marca vídeos que são versão traduzida/adaptada de outro canal. O código base aponta para o original.

**Todos os diretórios e arquivos de um vídeo usam o mesmo código:**

```
data/production/raw/PT-202606-047/
data/production/projects/PT-202606-047/
data/production/exports/PT-202606-047/
data/scratch/PT-202606-047/
data/graphics/thumbnails/PT/PT-202606-047/
```

### 7b. Configuração do DaVinci Resolve

O Resolve precisa ser configurado para trabalhar com os datasets do NAS corretamente.

**Modo de projeto: File-based (Project Libraries)**

Não usar o banco de dados interno do Resolve. Usar projetos baseados em arquivo (`.drp`), salvos diretamente em `production/projects/{código}/`. Isso permite:
- Backup via snapshots ZFS (o `.drp` é um arquivo, não um banco PostgreSQL)
- Acesso do editor remoto via SMB
- Versionamento natural pelo nome do arquivo

**Preferências do sistema (Resolve > Preferences > System):**

| Configuração | Caminho no NAS | Motivo |
|-------------|---------------|--------|
| Media Storage (volumes) | `/Volumes/production`, `/Volumes/broll`, `/Volumes/audio`, `/Volumes/graphics` | Resolve indexa esses volumes para busca de mídia |
| Scratch Disk (cache) | `/Volumes/scratch` | Proxies, optimized media, cache de render — tudo vai para o dataset correto (sync=disabled, quota=500G) |

**Project Settings (por projeto):**

| Configuração | Caminho |
|-------------|---------|
| Working Folders > Cache files | `/Volumes/scratch/{código}/cache/` |
| Working Folders > Gallery stills | `/Volumes/scratch/{código}/stills/` |
| Working Folders > Capture | `/Volumes/scratch/{código}/capture/` |

> **IMPORTANTE: Ordem de operações.** O footage **deve** estar em sua localização final (`production/raw/{código}/`) **ANTES** de ser importado no Resolve. O Resolve armazena caminhos absolutos internamente. Se você importar de `ingest/` e depois mover para `production/raw/`, toda a mídia aparecerá como "Media Offline" no projeto. Religar manualmente centenas de clips é perda de tempo evitável.

**Configuração do editor remoto:**

O editor acessa o NAS via SMB sobre Tailscale. No Mac do editor:

```bash
# Montar shares SMB no Finder (Cmd+K) ou via terminal:
# Os pontos de montagem devem espelhar os do criador
mount_smbfs //editor@nas.tailnet/production /Volumes/production
mount_smbfs //editor@nas.tailnet/scratch    /Volumes/scratch
mount_smbfs //editor@nas.tailnet/broll      /Volumes/broll
mount_smbfs //editor@nas.tailnet/audio      /Volumes/audio
mount_smbfs //editor@nas.tailnet/graphics   /Volumes/graphics
```

Usar os mesmos pontos de montagem em ambas as máquinas garante que os caminhos absolutos no projeto Resolve funcionem tanto para o criador quanto para o editor.

### 7c. Proxy Workflow

**O problema:** A rede é dual 1GbE Intel i210. Throughput real via SMB: ~110 MB/s por interface (880 Mbps). Isso é suficiente para edição single-stream de 4K, mas se torna gargalo em cenários mais pesados.

| Cenário de edição | Throughput necessário | Status na 1GbE |
|-------------------|-----------------------|-----------------|
| 4K single stream (H.264) | ~25 MB/s | OK |
| 4K com efeitos + B-roll | ~50-70 MB/s | OK, mas sem margem |
| Multicam 2-3 streams 4K | ~75-100 MB/s | Borderline — stuttering provável |
| 4K + proxies 720p | ~8-12 MB/s | Confortável |
| 4K + proxies 1080p | ~15-20 MB/s | Confortável |

**Boost gratuito: SMB Multichannel.** A Supermicro X11SCL-IF tem 2x Intel i210 1GbE. O SMB Multichannel (SMB 3.0+) permite que o cliente use ambas as interfaces simultaneamente, atingindo ~220 MB/s agregado. macOS suporta nativamente desde Ventura.

**Configuração do SMB Multichannel:**

| Interface | IP | Máscara | Gateway |
|-----------|-----|---------|---------|
| NIC 1 (igb0) | 192.168.18.250 | 255.255.255.0 | 192.168.18.1 |
| NIC 2 (igb1) | 192.168.18.251 | 255.255.255.0 | — (sem gateway) |

> **Não usar bonding/LACP.** SMB Multichannel opera na camada de aplicação e faz agregação automática sem configuração de switch. Basta que ambas as NICs estejam na mesma subnet com IPs distintos. O TrueNAS SCALE habilita Multichannel por padrão no serviço SMB.

**Verificar no Mac:**

```bash
# Verificar se Multichannel está ativo na conexão SMB
smbutil multichannel -a

# Saída esperada mostra 2 sessões ativas:
# Session: 1 (192.168.18.250:445)
# Session: 2 (192.168.18.251:445)
# Speed: 2 Gbps (aggregate)
```

Com Multichannel ativo (~220 MB/s), proxies são desnecessários para edição local single-stream 4K. Proxies continuam recomendados para multicam e para edição remota via Tailscale.

**Resolução de proxy — local vs. remoto:**

| Cenário | Resolução recomendada | Bitrate típico | Throughput necessário | Notas |
|---------|----------------------|----------------|----------------------|-------|
| **Edição remota (WAN via Tailscale)** | **720p H.264** | ~5 Mbps | ~0.6 MB/s | Recomendado. Tailscale WAN tipicamente 5-20 MB/s. 720p garante playback fluido. |
| **Edição local (LAN)** | **1080p H.264** | ~15 Mbps | ~1.9 MB/s | Boa qualidade para color grading preliminar. |
| **Edição local com Multichannel** | **Sem proxies** | — | ~25 MB/s (4K stream) | Com 2x 1GbE agregado, 4K single-stream é confortável. |

> **Correção de terminologia:** Para 4K (3840x2160), as resoluções derivadas são: **metade** = 1920x1080 (1080p), **quarto** = 960x540 (540p). O Resolve usa "Half Resolution" e "Quarter Resolution" com esses significados exatos. 720p (1280x720) é um terço da resolução 4K e corresponde à opção "1280x720" no menu de proxy.

**Gerar proxies no DaVinci Resolve:**

1. **Ingest e organização** — footage vai para `production/raw/{código}/` (fluxo normal)

2. **Gerar proxies no Resolve:**
   - Selecionar todos os clips no Media Pool
   - Botão direito > "Generate Proxy Media"
   - Resolução: **720p** para edição remota / **1080p** para edição local
   - Codec: **H.264** (baixo bitrate, decode rápido em CPU e GPU)
   - Destino: automático (vai para `scratch/` via Scratch Disk config)

3. **Editar com proxies:**
   - Playback > Proxy Mode > "Prefer Proxies"
   - Timeline fluida mesmo em multicam, mesmo em WAN via Tailscale
   - Todos os cortes, efeitos e grades são aplicados aos proxies

4. **Render final em full-res:**
   - Playback > Proxy Mode > "Off" (ou simplesmente renderizar — Resolve usa full-res automaticamente no Deliver)
   - Output vai para `production/exports/{código}/`

**Custo:** Tempo de geração dos proxies (~10-20 min para 1h de footage em 4K, processado localmente pelo Resolve — o Quick Sync do UHD P630 acelera encode H.264). Espaço em `scratch/` (~5% do original para 720p, ~10% para 1080p). Ambos são aceitáveis e contidos pela quota de 500 GB.

> **Regra de localização:** Proxies vão **sempre** para `scratch/{código}/proxies/`. Nunca armazenar proxies em `production/projects/{código}/`. Proxies são regeneráveis e não precisam de backup — `scratch/` tem `sync=disabled` exatamente para isso.

**Upgrade futuro:** Adaptador USB 2.5GbE custa ~R$ 100 cada (um para o NAS, um para o Mac). Dobra o throughput efetivo para ~280 MB/s, eliminando a necessidade de proxies na maioria dos cenários locais. Considerar quando o investimento fizer sentido.

### 7d. Export Versioning

Exports finais seguem uma convenção de nomes que identifica o destino, a resolução e a versão:

```
production/exports/
└── PT-202606-047/
    ├── PT-202606-047_youtube_4K_v1.mp4
    ├── PT-202606-047_youtube_1080p_v1.mp4
    ├── PT-202606-047_shorts_1080p_v1.mp4
    └── PT-202606-047_youtube_4K_v2.mp4      ← re-export após correção
```

**Formato:** `{código}_{destino}_{resolução}_v{N}.mp4`

| Campo | Valores possíveis |
|-------|-------------------|
| `destino` | `youtube`, `shorts`, `instagram`, `tiktok` |
| `resolução` | `4K`, `1080p`, `720p` |
| `versão` | `v1`, `v2`, ... (incrementa a cada re-export) |

Nunca sobrescrever um export existente. Incrementar a versão. Isso permite comparar versões e reverter se necessário. Limpeza de versões antigas pode ser feita mensalmente.

### 7e. Etapas Detalhadas do Pipeline

**1. Gravação**

Gravar com as câmeras (DJI Osmo Pocket, GoPro, iPhone). Cada câmera grava em seu cartão SD/NVMe interno. Não alterar nada no cartão após a gravação.

**2. Ingest**

Copiar o conteúdo completo do cartão para a landing zone:

```bash
# Padrão: {data}_{câmera}/
cp -r /Volumes/CARTAO/* /mnt/data/ingest/20260613_osmo/
cp -r /Volumes/GOPRO/*  /mnt/data/ingest/20260613_gopro/
```

**3. Verificação de integridade**

Verificar que a cópia está íntegra antes de formatar o cartão. **Este passo roda no Mac** (onde o cartão está inserido):

```bash
# ──────────────────────────────────────────────
# macOS (onde o cartão SD está montado):
# ──────────────────────────────────────────────

# Gerar checksums do cartão original
find /Volumes/CARTAO -type f -exec md5 -r {} + | sort > /tmp/card.md5

# Gerar checksums da cópia no NAS (montado via SMB)
find /Volumes/production/../ingest/20260613_osmo -type f -exec md5 -r {} + | sort > /tmp/nas.md5

# Comparar (saída vazia = idênticos)
diff /tmp/card.md5 /tmp/nas.md5

# ──────────────────────────────────────────────
# Alternativa: rodar no NAS via SSH (Linux):
# ──────────────────────────────────────────────

# No NAS, o comando é md5sum (não md5)
find /mnt/data/ingest/20260613_osmo -type f -exec md5sum {} + | sort > /tmp/nas.md5
```

> **Nota:** macOS usa `md5 -r` (flag `-r` produz output no formato compatível com `md5sum` do Linux: hash seguido do path). O Linux usa `md5sum`. Não confundir — `md5sum` não existe no macOS e `md5` não existe no Linux.

Só formatar o cartão após confirmação de checksum idêntico. Esta etapa leva 1-2 minutos e evita perda irreversível.

**4. Organizar**

Mover o footage verificado para o dataset de produção, usando o código do vídeo:

```bash
mkdir -p /mnt/data/production/raw/PT-202606-047
mv /mnt/data/ingest/20260613_osmo/* /mnt/data/production/raw/PT-202606-047/
mv /mnt/data/ingest/20260613_gopro/* /mnt/data/production/raw/PT-202606-047/
```

A partir deste momento, o footage está em seu local definitivo. Nunca mais mover.

**5. Criar projeto no Resolve**

Abrir DaVinci Resolve. Criar novo projeto no diretório correto:

- Project Libraries > Browse > `/Volumes/production/projects/PT-202606-047/`
- Nome do projeto: `PT-202606-047`
- Importar mídia de `/Volumes/production/raw/PT-202606-047/`

**6. Edição**

Com o projeto aberto e proxies gerados (se necessário):

- Footage: `production/raw/PT-202606-047/` (somente leitura)
- Projeto: `production/projects/PT-202606-047/` (leitura/escrita)
- Cache/proxies: `scratch/PT-202606-047/` (leitura/escrita, descartável)
- B-roll: `broll/*` (somente leitura — navegar por categoria)
- Áudio: `audio/sfx/*` e `audio/music/*` (somente leitura)
- Graphics: `graphics/lower-thirds/` (somente leitura)

O editor remoto acessa exatamente os mesmos caminhos via SMB/Tailscale.

**7. Export**

No Deliver do Resolve, exportar para `production/exports/PT-202606-047/`:

- YouTube principal: `PT-202606-047_youtube_4K_v1.mp4` (H.264, 4K, high bitrate)
- YouTube backup: `PT-202606-047_youtube_1080p_v1.mp4` (H.264, 1080p)
- Shorts (se aplicável): `PT-202606-047_shorts_1080p_v1.mp4` (9:16, 1080p)

**8. Thumbnail**

Criar thumbnail em `graphics/thumbnails/{canal}/{código}/`:

```
graphics/thumbnails/PT/PT-202606-047/
├── PT-202606-047_thumb_v1.psd    ← editável
└── PT-202606-047_thumb_v1.png    ← export para upload
```

**9. Publicação**

Upload para o YouTube via pipeline habitual. Após confirmação de publicação com sucesso:

- Limpar `scratch/PT-202606-047/` (proxies e cache não são mais necessários)
- Manter `production/raw/` e `production/exports/` (footage original e export final)
- O projeto em `production/projects/` permanece para eventuais re-edições

```bash
# Limpeza pós-publicação
rm -rf /mnt/data/scratch/PT-202606-047/
```

**Ciclo completo:** Gravação → Ingest → **Verificação (checksum)** → Organização → Projeto → Edição → Export → Thumbnail → Publicação → Limpeza do scratch. Com 4 vídeos por semana, este fluxo roda 4x por semana, com múltiplos vídeos potencialmente em etapas diferentes simultaneamente.

---

## 8. Permissoes SMB e Seguranca

### 8a. Usuarios do Sistema

| Usuario | Tipo | Proposito |
|---------|------|-----------|
| `thiago` | Local | Owner — acesso total a todos os datasets |
| `editor` | Local | Editor remoto — acesso restrito a producao |
| `plex` | Service | Conta de servico para Plex/Jellyfin — somente leitura em media |

Nao criar conta `guest`. Acesso anonimo ao SMB permanece desabilitado.

Criar os usuarios em **Credentials > Local Users**:

```
thiago  — senha 20+ chars, shell: nologin, home: /nonexistent
editor  — senha 20+ chars, shell: nologin, home: /nonexistent, enabled: false (ativar sob demanda)
plex    — senha gerada, shell: nologin, home: /nonexistent
```

Criar grupos: `creators` (thiago, editor), `owner-only` (thiago).

### 8b. Matriz de Permissoes

| Dataset | Share SMB | Thiago | Editor | Guest |
|---------|-----------|--------|--------|-------|
| `ingest` | `ingest` | R+W | Nenhum | Nenhum |
| `production/raw` | `production` | R+W | **Read-only** | Nenhum |
| `production/projects` | `production` | R+W | **R+W** | Nenhum |
| `production/exports` | `production` | R+W | **R+W** | Nenhum |
| `scratch` | `scratch` | R+W | R+W | Nenhum |
| `broll` | `broll` | R+W | Read-only | Nenhum |
| `audio` | `audio` | R+W | Read-only | Nenhum |
| `graphics` | `graphics` | R+W | Read-only | Nenhum |
| `photos` | `photos` | R+W | Nenhum | Nenhum |
| `media` | `media` | R+W | Nenhum | Nenhum |
| `documents` | `documents` | R+W | Nenhum | Nenhum |
| `backups` | `backups` | R+W | Nenhum | Nenhum |
| `apps` | — (sem share) | Via sistema | Nenhum | Nenhum |

**Por que o editor e R/O em `production/raw`:** footage original e insubstituivel. O editor precisa ler para montar proxies e verificar takes, mas nunca deve poder deletar ou sobrescrever. Um `rm -rf` acidental em raw e irrecuperavel entre snapshots.

**Por que `media` nao tem acesso de guest:** Plex e Jellyfin autenticam via seus proprios sistemas. O acesso ao filesystem usa a conta de servico `plex`, configurada diretamente no app. Nunca expor via SMB anonimo.

### 8c. ACLs NFSv4 — Implementacao Correta no TrueNAS SCALE

> **ATENCAO:** TrueNAS SCALE usa **NFSv4 ACLs** por padrao em datasets ZFS (mesmo para shares SMB). Comandos POSIX como `setfacl` vao falhar ou produzir resultados inesperados. Usar exclusivamente NFSv4 ACLs conforme descrito abaixo.

#### Metodo 1: Via TrueNAS UI (recomendado)

Para cada child dataset de `production`, configurar permissoes diferenciadas:

Para cada child dataset, ir em **Datasets > [dataset] > Permissions > Edit**, confirmar ACL Type = `NFSv4`, e adicionar entrada:

| Dataset | Who | Permissions | Flags | Type |
|---------|-----|-------------|-------|------|
| `data/production/raw` | User `editor` | Read | File Inherit + Directory Inherit | Allow |
| `data/production/projects` | User `editor` | Full Control | File Inherit + Directory Inherit | Allow |
| `data/production/exports` | User `editor` | Full Control | File Inherit + Directory Inherit | Allow |

Marcar **Apply permissions recursively** e **Save** em cada um.

#### Metodo 2: CLI com `nfs4_setfacl`

Para quem prefere ou precisa de automacao via linha de comando:

```bash
# production/raw — editor somente leitura
nfs4_setfacl -R -a A:fdg:editor@:rxtncy /mnt/data/production/raw

# production/projects — editor leitura e escrita completa
nfs4_setfacl -R -a A:fdg:editor@:rwaDdxtTnNcCoy /mnt/data/production/projects

# production/exports — editor leitura e escrita completa
nfs4_setfacl -R -a A:fdg:editor@:rwaDdxtTnNcCoy /mnt/data/production/exports

# broll, audio, graphics — editor somente leitura
for ds in broll audio graphics; do
  nfs4_setfacl -R -a A:fdg:editor@:rxtncy /mnt/data/${ds}
done
```

**Formato da ACE NFSv4 explicado:**

```
A:fdg:editor@:rxtncy
│ │││ │       └───── permissoes (r=read, x=execute, t=read attrs, n=read named attrs, c=read ACL, y=synchronize)
│ │││ └───────────── principal (usuario ou grupo)
│ ││└─────────────── g = group flag (opcional, usar quando o principal e um grupo)
│ │└──────────────── d = directory inherit (novos subdiretorios herdam esta ACE)
│ └───────────────── f = file inherit (novos arquivos herdam esta ACE)
└─────────────────── A = Allow (D = Deny)
```

**Referencia rapida de permissoes:** `r`=read, `w`=write, `a`=append, `x`=execute, `d`=delete child, `D`=delete, `t`/`T`=read/write attrs, `n`/`N`=read/write named attrs, `c`/`C`=read/write ACL, `o`=write owner, `y`=synchronize.

**Verificar ACLs aplicadas:**
```bash
nfs4_getfacl /mnt/data/production/raw
nfs4_getfacl /mnt/data/production/projects
```

### 8d. Hardening SMB

Configurar em **System Settings > Services > SMB > Advanced**:

| Parametro | Valor | Justificativa |
|-----------|-------|---------------|
| `server min protocol` | `SMB3` | SMBv1 tem vulnerabilidades criticas (EternalBlue). SMBv2 tem problemas conhecidos. |
| `server smb encrypt` | `desired` | Criptografia oportunista; shares especificos forcam abaixo. |
| `server signing` | `required` | Previne ataques man-in-the-middle em todos os shares. |
| `smb1 support` | `disabled` | Redundante com min protocol, mas explicito. |

Para shares com dados sensiveis, forcar criptografia via auxiliary parameter no share:

```
# production, documents, photos — forcar SMB3 encryption
smb encrypt = required
```

### 8e. Auditoria SMB

Habilitar `vfs_full_audit` no share `production` para rastrear operacoes do editor.

> **Nota:** ao combinar `vfs_full_audit` com `vfs_fruit` (secao 8g), a ordem dos modulos importa. Ver secao 8g para a configuracao combinada.

```
# Auxiliary Parameters do share production (se SEM vfs_fruit):
vfs objects = full_audit
full_audit:prefix = %u|%I|%m|%S
full_audit:success = mkdir rmdir rename unlink write pwrite
full_audit:failure = mkdir rmdir rename unlink write pwrite
full_audit:facility = local5
full_audit:priority = notice
```

Isso registra quem criou, renomeou ou deletou arquivos. Os logs vao para `/var/log/syslog` (filtrar por `local5`). Essencial para accountability quando multiplas pessoas acessam o mesmo share.

**Consultar logs:** `grep 'local5' /var/log/syslog | grep 'editor|' | tail -30` (operacoes do editor) ou `grep 'unlink\|rmdir'` (delecoes).

### 8f. Controle de Acesso Temporal do Editor

O editor nao trabalha 24/7. Manter a conta desabilitada por padrao e ativar sob demanda:

```bash
# Ativar editor (via TrueNAS UI ou CLI)
midclt call user.update <editor_id> '{"locked": false}'

# Desativar ao final do periodo de edicao
midclt call user.update <editor_id> '{"locked": true}'
```

Para descobrir o `<editor_id>`: `midclt call user.query '[["username", "=", "editor"]]'`. Alternativa futura: cron que desabilita a conta automaticamente apos N horas.

### 8g. Compatibilidade macOS — vfs_fruit

O modulo `vfs_fruit` melhora significativamente a compatibilidade do SMB com clientes macOS (Finder, DaVinci Resolve no Mac). Sem ele, o Finder tem problemas com resource forks, metadata, e `.DS_Store`.

**Configurar em cada share SMB acessado por Mac** (Sharing > SMB > [share] > Advanced > Auxiliary Parameters):

```
vfs objects = fruit streams_xattr full_audit
fruit:metadata = stream
fruit:model = MacSamba
fruit:posix_rename = yes
fruit:veto_appledouble = no
fruit:nfs_aces = no
fruit:wipe_intentionally_left_blank_rfork = yes
fruit:delete_empty_adfiles = yes
full_audit:prefix = %u|%I|%m|%S
full_audit:success = mkdir rmdir rename unlink write pwrite
full_audit:failure = mkdir rmdir rename unlink write pwrite
full_audit:facility = local5
full_audit:priority = notice
```

**Parametros explicados:**

**Parametros criticos:**
- `vfs objects = fruit streams_xattr full_audit` — ordem importa (fruit primeiro, audit por ultimo)
- `fruit:metadata = stream` — metadata macOS como streams NTFS (compativel com ZFS xattrs)
- `fruit:posix_rename = yes` — renomeacao atomica (previne corrupcao em projetos DaVinci)
- `fruit:nfs_aces = no` — **critico:** desabilita traducao de ACEs pelo Samba, evitando conflito com as NFSv4 ACLs gerenciadas pelo TrueNAS (secao 8c)
- `fruit:wipe_intentionally_left_blank_rfork = yes` / `fruit:delete_empty_adfiles = yes` — limpeza de resource forks e AppleDouble vazios

**Para shares sem auditoria** (ex.: `media`, `broll`), omitir `full_audit` da lista de `vfs objects`:

```
vfs objects = fruit streams_xattr
fruit:metadata = stream
fruit:model = MacSamba
fruit:posix_rename = yes
fruit:veto_appledouble = no
fruit:nfs_aces = no
fruit:wipe_intentionally_left_blank_rfork = yes
fruit:delete_empty_adfiles = yes
```

**Time Machine:** se no futuro quiser usar o NAS como destino de Time Machine, criar um share dedicado com `fruit:time machine = yes`. Nao habilitar em shares de producao — backups do Time Machine consomem espaco agressivamente.

---

## 9. Protocolo do Editor Remoto

### 9a. Arquitetura de Acesso

```
Editor (casa dele)                         NAS (casa do irmao, Brasil)
┌─────────────┐     Tailscale tunnel      ┌─────────────────┐
│  DaVinci     │ <──── SMB over ────────> │  production/     │
│  Resolve     │     WireGuard mesh        │    projects/     │
│  (proxies    │     5-20 MB/s WAN         │    exports/      │
│   locais)    │                           │    raw/ (R/O)    │
└─────────────┘                           └─────────────────┘
```

**Metodo de acesso:** Tailscale (mesh VPN baseado em WireGuard). Zero port forwarding, zero configuracao de firewall no router. O editor instala Tailscale, recebe convite para a tailnet, e acessa os shares SMB pelo IP Tailscale do NAS.

**Largura de banda esperada:** 5-20 MB/s sobre WAN. Isso e suficiente para transferir proxies e projetos, mas **nao e viavel para edicao nativa de 4K** (que exige 50-100 MB/s sustentado). O workflow de proxy e obrigatorio.

#### Instalacao do Tailscale no TrueNAS SCALE

TrueNAS SCALE 25.10 (Goldeye) oferece Tailscale como app oficial no catalogo. Instalar via UI:

1. **Apps > Discover Apps** — buscar "Tailscale"
2. **Install** — configurar:
   - **Auth Key:** gerar em https://login.tailscale.com/admin/settings/keys — "Generate auth key" (reauth off, ephemeral off)
   - **Advertise routes:** `192.168.18.0/24` (permite que dispositivos na tailnet acessem a LAN — util para acessar IPMI 192.168.18.249 remotamente)
   - **Userspace networking:** OFF (usar kernel networking para melhor performance)
   - **Accept routes:** ON (se quiser acessar a rede do editor)
3. **Start** e verificar no Tailscale admin console que o NAS apareceu
4. **Anotar o IP Tailscale** do NAS (ex: `100.x.y.z`) — este e o IP que o editor usara nos shares SMB

**Pos-instalacao:**

```bash
# Verificar status (via shell do TrueNAS)
tailscale status

# Habilitar como exit node (opcional, para acesso total a LAN)
tailscale set --advertise-exit-node

# Confirmar SMB acessivel via Tailscale (do Mac do editor)
smbclient -L //100.x.y.z -U editor
```

**ACL no Tailscale admin console:** restringir o que o editor pode acessar:
```json
{
  "acls": [
    {"action": "accept", "src": ["tag:editor"], "dst": ["tag:nas:445"]},
    {"action": "accept", "src": ["tag:owner"],  "dst": ["*:*"]}
  ],
  "tagOwners": {
    "tag:editor": ["tnfigueiredotv@gmail.com"],
    "tag:nas": ["tnfigueiredotv@gmail.com"],
    "tag:owner": ["tnfigueiredotv@gmail.com"]
  }
}
```

Isso limita o editor apenas a porta SMB (445) do NAS — sem acesso ao TrueNAS web UI, IPMI, ou outros servicos.

### 9b. Workflow de Proxy

O editor nunca edita diretamente sobre a rede. O fluxo e:

```
1. Thiago ingere footage      ->  production/raw/{codigo}/
2. Thiago gera proxies        ->  production/projects/{codigo}/proxies/
   (1080p H.264, no Resolve)
3. Editor baixa projeto       <-  production/projects/{codigo}/
   + proxies para disco local
4. Editor edita localmente    ->  corta, monta, ajusta com proxies
5. Editor sobe .drp revisado  ->  production/projects/{codigo}/
6. Thiago abre projeto        ->  relink para raw full-res
7. Thiago renderiza final     ->  production/exports/{codigo}/
```

**Geracao de proxies no Resolve:**
1. Project Settings > Optimized Media and Render Cache > Proxy media resolution: Half (1080p de 4K)
2. Format: H.264 (compatibilidade maxima, tamanho pequeno)
3. Na Media Pool: selecionar clips > right-click > Generate Proxy Media
4. Copiar pasta `proxies/` para dentro do projeto

**Tamanho tipico de proxy:** ~2-5 GB por video (vs. ~45 GB de raw). Download de ~30 minutos a 5 MB/s.

### 9c. Protocolo de Handoff

Estrutura obrigatoria dentro de cada projeto:

```
production/projects/{codigo}/
├── {codigo}.drp                    # Projeto master do Thiago
├── {codigo}_editor_v1.drp          # Primeiro corte do editor
├── {codigo}_editor_v2.drp          # Revisao do editor
├── proxies/                        # Proxies 1080p H.264
├── assets/                         # Graficos, lower thirds
└── HANDOFF.md                      # Status e notas
```

**Formato do `HANDOFF.md`:**

```markdown
# Handoff — {codigo}

## Status: READY_FOR_EDIT

## Briefing
- Video sobre: [tema]
- Duracao alvo: [minutos]
- Estilo: [referencia ou canal]
- Notas: [instrucoes especificas de corte]

## Timeline
- 2026-06-13 09:00 — Thiago: footage ingerido, proxies gerados
- 2026-06-13 09:30 — Thiago: status -> READY_FOR_EDIT

## Revisoes
(preenchido durante o processo)
```

**Convencao de status:**

| Status | Significado | Quem age |
|--------|-------------|----------|
| `READY_FOR_EDIT` | Footage e proxies prontos | Editor |
| `IN_PROGRESS` | Editor trabalhando | — |
| `REVIEW` | Editor finalizou, aguardando feedback | Thiago |
| `APPROVED` | Aprovado para render final | Thiago |
| `REVISION_NEEDED` | Thiago quer alteracoes (notas abaixo) | Editor |
| `FINAL` | Renderizado e publicado | — |

**Regra de ouro:** apenas uma pessoa trabalha no projeto por vez. O `HANDOFF.md` e a fonte de verdade. Snapshots horarios de `production/projects/` sao a rede de seguranca para conflitos.

### 9d. Workflow de Review

Tres opcoes, da melhor para a mais simples:

| Opcao | Ferramenta | Pros | Contras |
|-------|-----------|------|---------|
| A | Frame.io | Comentarios com timecode, markup visual | Custo (~$15/mes) |
| B | Review cut no NAS | Sem custo, tudo centralizado | Editor precisa renderizar e subir |
| C | Google Drive | Simples, gratuito | Fora do NAS, sem timecode |

**Opcao B (recomendada inicialmente):**
1. Editor renderiza cut de review (1080p, qualidade media) em `production/exports/{codigo}/review/`
2. Thiago assiste e anota feedback no `HANDOFF.md`
3. Zero custo adicional, tudo dentro do ecossistema NAS

**Migrar para Frame.io** quando o volume de projetos simultaneos justificar (>2 projetos em paralelo com o editor).

### 9e. Transferencias em Bulk — rsync via SSH

SMB sobre Tailscale funciona bem para o workflow interativo diario (DaVinci abrindo projetos, lendo proxies). Porem, SMB e um protocolo "chatty" — cada operacao de metadata exige round-trips individuais, o que penaliza transferencias grandes sobre WAN com latencia alta (Brasil-Tailandia ~200-300ms RTT).

Para **transferencias em bulk** (sync inicial de footage, entrega de lotes de proxies, download de projetos grandes), usar **rsync sobre SSH** via Tailscale:

```bash
# === DO MAC PARA O NAS (upload de footage) ===
rsync -avhP --checksum \
  -e "ssh -p 22" \
  ~/footage/PT-202606-047/ \
  thiago@100.x.y.z:/mnt/data/production/raw/PT-202606-047/

# === DO NAS PARA O MAC (download de proxies) ===
rsync -avhP --checksum \
  -e "ssh -p 22" \
  thiago@100.x.y.z:/mnt/data/production/projects/PT-202606-047/proxies/ \
  ~/Projects/PT-202606-047/proxies/

# === EDITOR: baixar projeto completo ===
rsync -avhP --checksum \
  -e "ssh -p 22" \
  editor@100.x.y.z:/mnt/data/production/projects/PT-202606-047/ \
  ~/Projects/PT-202606-047/
```

**Flags:** `-a` (archive, preserva tudo), `-v` (verbose), `-h` (human-readable), `-P` (progresso + resume), `--checksum` (verifica integridade). Opcional: `-z` (compressao — util para .drp, nao para video ja comprimido).

**Vantagens sobre SMB para bulk:** single-stream (menos round-trips, melhor throughput com latencia alta), resume automatico se a conexao cair, delta transfer (apenas bytes modificados).

**Recomendacao pratica:**

| Cenario | Protocolo |
|---------|-----------|
| Editor abrindo projeto no DaVinci | SMB (Finder monta share) |
| Editor salvando .drp durante edicao | SMB (DaVinci salva direto) |
| Download inicial de projeto + proxies | rsync via SSH |
| Upload de footage raw (Thiago -> NAS) | rsync via SSH |
| Entrega de lote de exports | rsync via SSH |

**Prerequisito:** habilitar SSH no TrueNAS (System Settings > Services > SSH) e restringir via Tailscale ACL para que apenas dispositivos autorizados acessem a porta 22.

### 9f. Seguranca do Acesso Remoto

| Camada | Protecao |
|--------|----------|
| Rede | Tailscale (WireGuard) — criptografia end-to-end, zero trust |
| Autenticacao | Conta `editor` com senha 20+ chars |
| Autorizacao | ACLs NFSv4: R/O em raw, R/W em projects e exports |
| Monitoramento | `vfs_full_audit` no share production |
| Revogacao | Desabilitar conta `editor` + remover device da tailnet |

Para revogar acesso do editor completamente:
1. Desabilitar conta `editor` no TrueNAS
2. Remover dispositivo do editor da tailnet (Tailscale admin console)
3. Verificar logs de auditoria para atividade recente

---

## 10. Estrategia de Backup

### 10a. Regra 3-2-1

A regra 3-2-1 exige: **3** copias dos dados, em **2** midias diferentes, com **1** offsite. Estrategia:

| Copia | Midia | Localizacao | Conteudo |
|-------|-------|-------------|----------|
| 1 (primaria) | NVMe pool ZFS | NAS (casa do irmao, Brasil) | Tudo |
| 2 (local) | Seagate 20TB USB | Ao lado do NAS | production, broll, audio, graphics, photos, documents |
| 3 (offsite) | Backblaze B2 | Cloud | documents, photos (imediato); production/raw (quando budget permitir) |

### 10b. Backup Local — ZFS Send/Receive

**Opcao preferida:** formatar o Seagate como pool ZFS. Vantagens sobre rsync:

- Transferencia incremental a nivel de bloco (ordens de magnitude mais rapido)
- Snapshots atomicos preservados na copia
- Verificacao de integridade via checksums ZFS
- Restore e um `zfs receive` — sem ambiguidade

```bash
# === SETUP INICIAL (uma vez) ===

# Criar pool no Seagate (substitua sdX pelo device correto — confirmar com lsblk)
zpool create -o ashift=12 -O compression=lz4 backup /dev/sdX

# Snapshot recursivo de todos os datasets a copiar
zfs snapshot -r data/production@backup-initial
zfs snapshot -r data/broll@backup-initial
zfs snapshot -r data/audio@backup-initial
zfs snapshot -r data/graphics@backup-initial
zfs snapshot -r data/photos@backup-initial
zfs snapshot -r data/documents@backup-initial

# Full send (demora na primeira vez — todo o conteudo transferido)
for ds in production broll audio graphics photos documents; do
  zfs send -R data/${ds}@backup-initial | zfs receive -F backup/${ds}
done


# === INCREMENTAL DIARIO ===

#!/bin/bash
# /usr/local/bin/nas-backup-zfs.sh
set -euo pipefail

DATE=$(date +%Y%m%d)
LOG="/var/log/nas-backup.log"
DATASETS="production broll audio graphics photos documents"

echo "=== ZFS Backup started $(date) ===" >> "$LOG"

for ds in $DATASETS; do
  # Encontrar ultimo snapshot de backup
  LAST=$(zfs list -t snapshot -o name -s creation -r data/${ds} \
    | grep '@backup-' | tail -1 | cut -d@ -f2)

  NEW="backup-${DATE}"

  # Criar novo snapshot
  zfs snapshot -r data/${ds}@${NEW}

  # Enviar incremental
  if zfs send -R -i @${LAST} data/${ds}@${NEW} | zfs receive -F backup/${ds} 2>> "$LOG"; then
    echo "OK: ${ds} (${LAST} -> ${NEW})" >> "$LOG"
  else
    echo "FALHA: ${ds}" >> "$LOG"
    # Descomente para notificacao:
    # curl -s "https://api.pushover.net/1/messages.json" \
    #   -d "token=XXX&user=YYY&message=Backup ZFS falhou: ${ds}"
  fi
done

echo "=== ZFS Backup finished $(date) ===" >> "$LOG"
```

### 10c. Backup Local — rsync (alternativa se Seagate permanecer ext4/NTFS)

Se o Seagate **nao** puder ser formatado como ZFS (ex.: ja tem dados a preservar):

```bash
#!/bin/bash
# /usr/local/bin/nas-backup-rsync.sh
set -euo pipefail

DEST="/mnt/seagate20tb"
DATASETS="production broll audio graphics photos documents"
LOG="/var/log/nas-backup.log"
DELETED_DIR="${DEST}/.versions/$(date +%Y-%m-%d)"

echo "=== rsync Backup started $(date) ===" >> "$LOG"

for ds in $DATASETS; do
  echo "Backing up ${ds}..." >> "$LOG"

  rsync -avh \
    --backup --backup-dir="$DELETED_DIR/${ds}" \
    --checksum \
    --log-file="$LOG" \
    "/mnt/data/${ds}/" "${DEST}/${ds}/"

  RC=$?
  if [ $RC -ne 0 ]; then
    echo "FALHA: ${ds} (exit code ${RC})" >> "$LOG"
    # curl -s "https://api.pushover.net/1/messages.json" \
    #   -d "token=XXX&user=YYY&message=Backup rsync falhou: ${ds}"
  fi
done

# Limpar versoes antigas (manter 30 dias)
find "${DEST}/.versions/" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;

echo "=== rsync Backup finished $(date) ===" >> "$LOG"
```

**Diferencas criticas em relacao a um rsync ingenuo:**

| Recurso | rsync ingenuo | Este script |
|---------|--------------|-------------|
| Arquivos deletados no source | Deletados no backup (`--delete`) | Preservados 30 dias (`--backup --backup-dir`) |
| Verificacao de integridade | mtime + tamanho (falha com corrupcao silenciosa) | Checksum completo (`--checksum`) |
| Tratamento de erro | Ignora | Exit code verificado, notificacao |
| Log | Nenhum | Arquivo persistente |
| Ransomware | Propaga imediatamente | 30 dias de versoes anteriores |

### 10d. Backup do PostgreSQL do Immich

O Immich armazena metadata de fotos e embeddings de ML no PostgreSQL rodando dentro de seu container Docker. Snapshots ZFS do dataset `data/apps/immich/` capturam os arquivos do banco, mas um dump logico via `pg_dump` e mais confiavel — garante consistencia transacional independente do estado do filesystem.

```bash
#!/bin/bash
# /usr/local/bin/immich-db-backup.sh
# Backup logico do PostgreSQL do Immich
set -euo pipefail

BACKUP_DIR="/mnt/data/backups/immich-db"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M)
LOG="/var/log/immich-db-backup.log"

echo "=== Immich DB backup started $(date) ===" >> "$LOG"

# Dump completo do PostgreSQL do Immich
# Nota: ajustar nome do container se diferente (verificar com: docker ps | grep postgres)
if docker exec immich_postgres pg_dumpall -U postgres \
  | gzip > "${BACKUP_DIR}/immich-db-${DATE}.sql.gz"; then
  SIZE=$(du -sh "${BACKUP_DIR}/immich-db-${DATE}.sql.gz" | cut -f1)
  echo "OK: immich-db-${DATE}.sql.gz (${SIZE})" >> "$LOG"
else
  echo "FALHA: pg_dumpall retornou erro" >> "$LOG"
  # Descomente para notificacao:
  # curl -s "https://api.pushover.net/1/messages.json" \
  #   -d "token=XXX&user=YYY&message=Backup Immich DB falhou"
fi

# Manter apenas ultimos 14 dias
DELETED=$(find "$BACKUP_DIR" -name "immich-db-*.sql.gz" -mtime +14 -delete -print | wc -l)
[ "$DELETED" -gt 0 ] && echo "Limpeza: ${DELETED} backups antigos removidos" >> "$LOG"

echo "=== Immich DB backup finished $(date) ===" >> "$LOG"
```

**Agendar:** cron diario as 02:30 (antes do backup ZFS das 03:00).

```
# Tasks > Cron Jobs > Add
# Description: Immich PostgreSQL Backup
# Command: /usr/local/bin/immich-db-backup.sh
# Schedule: 30 2 * * *
# Run As User: root
```

**Restauracao:** parar Immich (`docker compose down`), restaurar (`gunzip -c <dump> | docker exec -i immich_postgres psql -U postgres`), reiniciar (`docker compose up -d`).

**Tamanho estimado:** ~50-200 MB comprimido por dump. 14 dias de retencao consomem ~1-3 GB.

### 10e. Backup Offsite — Backblaze B2

Configurar rclone para sync offsite dos dados insubstituiveis.

#### Setup inicial

```bash
# Instalar rclone (se nao disponivel)
apt install rclone

# Configurar remote B2 (interativo)
rclone config
# -> New remote -> nome: b2 -> tipo: Backblaze B2 -> Application Key ID + Key
```

> **Nota sobre `rclone config`:** a configuracao e interativa. O comando `rclone config password set` nao existe. Para criptografar o arquivo de configuracao, usar `rclone config` e selecionar a opcao "Set configuration password" no menu, ou definir a variavel `RCLONE_CONFIG_PASS` antes de executar qualquer comando.

#### Criar bucket no B2

**Object Lock (imutabilidade) deve ser habilitado NO MOMENTO DA CRIACAO do bucket.** Nao e possivel adicionar Object Lock a um bucket existente — esta e uma limitacao do B2 (e do S3).

```
B2 Console > Buckets > Create a Bucket:
  Bucket Name: nas-backup-thiago (nome unico global)
  Files in Bucket are: Private
  Default Encryption: Enable (Server-Side Encryption)
  Object Lock: Enable  <-- MARCAR AQUI, nao pode ser adicionado depois
  Default Retention: Governance, 30 days
```

**Governance vs. Compliance:** Governance permite que um admin com permissao especial delete versoes antes da retencao (recomendado — permite correcao de erros). Compliance e irreversivel — ninguem pode deletar, nem o dono da conta.

#### Application key com permissao minima

Criar uma key dedicada para rclone com apenas as permissoes necessarias:

```
B2 > App Keys > Add a New Application Key:
  Name: nas-backup-rclone
  Bucket: nas-backup-thiago (somente este)
  Capabilities: listBuckets, listFiles, readFiles, writeFiles
  [ ] deleteFiles     <-- NAO marcar
  [ ] deleteBuckets   <-- NAO marcar
```

Se o NAS for comprometido, o atacante pode adicionar lixo mas nao pode destruir backups existentes. Combinado com Object Lock, mesmo uma key com `deleteFiles` nao conseguiria apagar versoes dentro do periodo de retencao.

**Implicacao de custo do Object Lock:** cada versao de arquivo consume armazenamento durante o periodo de retencao. Se um arquivo de 10 GB for sobrescrito 3 vezes em 30 dias, voce paga por 30 GB. Para raw footage (write-once), isso nao e problema. Para datasets com muita modificacao, pode dobrar o custo.

#### Scripts de sync

```bash
# === SYNC DIARIO — datasets pequenos e insubstituiveis ===
# ~50 GB total -> ~R$ 3/mes no B2

rclone copy /mnt/data/documents/ b2:nas-backup-thiago/documents/ \
  --log-file /var/log/rclone-offsite.log \
  --log-level INFO

rclone copy /mnt/data/photos/ b2:nas-backup-thiago/photos/ \
  --log-file /var/log/rclone-offsite.log \
  --log-level INFO


# === SYNC SEMANAL — raw footage (grande, caro) ===
# ~2 TB -> ~R$ 50/mes no B2 (ajustar conforme budget)

rclone copy /mnt/data/production/raw/ b2:nas-backup-thiago/production-raw/ \
  --bwlimit 5M \
  --transfers 2 \
  --log-file /var/log/rclone-offsite.log \
  --log-level INFO
```

**Custos estimados no Backblaze B2:**

| Dado | Tamanho | Custo mensal (armazenamento) |
|------|---------|------------------------------|
| documents + photos | ~50 GB | ~R$ 3 |
| production/raw | ~2 TB (cresce ~800 GB/mes) | ~R$ 50 |
| Egress (download) | Primeiro 1 GB gratis/dia | R$ 0 (uso normal) |

**Por que `rclone copy` e nao `rclone sync`:** `sync` propaga delecoes — se um arquivo for acidentalmente deletado no NAS (ou por ransomware), o proximo sync o deleta no B2 tambem. `copy` apenas adiciona arquivos novos/modificados, nunca deleta no destino.

#### Protecao adicional — Lifecycle Rules

Habilitar retencao de versoes anteriores no bucket:

```
Bucket Settings > Lifecycle Rules:
  Keep prior versions for: 30 days
  Hide files automatically: Never
```

Isso garante que mesmo se um `rclone copy` sobrescrever um arquivo com uma versao corrompida, a versao anterior fica disponivel por 30 dias.

#### Criptografia da config do rclone

O rclone armazena application keys em texto plano em `~/.config/rclone/rclone.conf`. Proteger:

```bash
# Criptografar a configuracao do rclone (interativo — define senha master)
rclone config
# -> Selecionar "s) Set configuration password"
# -> Digitar senha forte

# A partir de agora, rclone pede a senha ao rodar
# Para cron jobs automatizados, armazenar a senha em arquivo com permissao restrita:
echo 'minha-senha-rclone' > /root/.rclone-pass
chmod 400 /root/.rclone-pass

# No script de backup:
export RCLONE_CONFIG_PASS=$(cat /root/.rclone-pass)
rclone copy /mnt/data/documents/ b2:nas-backup-thiago/documents/ ...
```

**Prioridade de implementacao:** documents e photos primeiro (baixo custo, alto valor). production/raw quando o budget permitir.

### 10f. O Que Copiar e Por Que

| Dataset | Backup local | Offsite | Justificativa |
|---------|-------------|---------|---------------|
| production/raw | Sim | Sim (semanal) | Footage original. **Insubstituivel.** |
| production/projects | Sim | Opcional | Projeto pode ser refeito, mas representa horas de trabalho. |
| production/exports | Sim | Nao | Regeneravel a partir de raw + project. |
| broll | Sim | Nao | Construido ao longo de meses/anos. Dificil recriar. |
| audio | Sim | Nao | Licencas de download existem (Artlist), mas re-curar e trabalhoso. |
| graphics | Sim | Nao | Templates, brand assets, fontes organizadas. Recriar e demorado. |
| photos | Sim | Sim (diario) | Fotos pessoais. **Insubstituivel.** |
| documents | Sim | Sim (diario) | Documentos pessoais e financeiros. **Insubstituivel.** |
| backups/immich-db | Sim (e o proprio backup) | Opcional | Dump do PostgreSQL do Immich. Pequeno, mas importante. |
| ingest | Nao | Nao | Transitorio — tudo ja foi movido para production. |
| scratch | Nao | Nao | Cache do Resolve. Regeneravel automaticamente. |
| media | Nao | Nao | Entretenimento. Re-download possivel. |
| backups | Nao | Nao | Ja e copia. |
| apps | Nao | Nao | Configs de container vivem em docker-compose ou TrueNAS. |

### 10g. Snapshots ZFS — Retencao

Configurar em **Data Protection > Periodic Snapshot Tasks**.

> **CRITICO:** cada tarefa de snapshot deve ter o campo **Snapshot Lifetime** (ou equivalente `--keep-last`) configurado. Sem limite, snapshots acumulam indefinidamente e consomem espaco ate lotar o pool.

| Dataset | Frequencia | Retencao (dias) | Max Snapshots | Justificativa |
|---------|-----------|-----------------|---------------|---------------|
| production/raw | Diario | 14 | 14 | Write-once. Mudancas raras apos ingestao. |
| production/projects | Horario | 24h | 24 | Protecao durante edicao ativa. |
| production/projects | Diario | 14 | 14 | Historico de 2 semanas para rollback. |
| production/exports | Diario | 7 | 7 | Regeneravel. Snapshot minimo. |
| broll | Diario | 14 | 14 | Adicoes incrementais, mudancas infrequentes. |
| audio | Diario | 14 | 14 | Idem. |
| graphics | Diario | 14 | 14 | Idem. |
| photos | Diario | 30 | 30 | Pessoal. Retencao longa. |
| documents | Diario | 30 | 30 | Pessoal. Retencao longa. |
| backups | Diario | 7 | 7 | Protecao minima do backup local. |
| apps | Diario | 7 | 7 | Configs de container. |
| media | Semanal | 4 semanas | 4 | Substituivel. Snapshot de cortesia. |
| ingest | Diario | 3 | 3 | Safety net curto durante organizacao. |
| scratch | Nenhum | — | — | Regeneravel. Snapshot desperdicaria IOPS. |

**Configuracao no TrueNAS:** em **Tasks > Periodic Snapshot Tasks**, para cada tarefa definir Dataset, Recursive = sim, e **Snapshot Lifetime** conforme a coluna "Retencao". O TrueNAS destroi automaticamente snapshots que excedem o lifetime. Verificar: `zfs list -t snapshot -o name,used,creation -s creation data/<dataset>`.

**Como acessar snapshots para recuperacao:**

Cada dataset ZFS expoe um diretorio oculto `.zfs/snapshot/` com todas as versoes disponiveis:

```bash
# Listar snapshots disponiveis
ls /mnt/data/production/projects/.zfs/snapshot/
# auto-2026-06-12_14-00  auto-2026-06-12_15-00  auto-2026-06-13_08-00  ...

# Recuperar um arquivo deletado acidentalmente
cp /mnt/data/production/projects/.zfs/snapshot/auto-2026-06-12_14-00/PT-202606-047/PT-202606-047.drp \
   /mnt/data/production/projects/PT-202606-047/PT-202606-047.drp

# Recuperar via SMB (Windows/macOS): navegar ate
# \\nas\production\projects\.zfs\snapshot\auto-2026-06-12_14-00\
```

**Ativar `Allow .zfs snapshot browsing`** no share SMB (Sharing > SMB > [share] > Advanced > Other Options) para que `.zfs` seja visivel via rede.

### 10h. Protecao contra Ransomware

Ransomware que criptografa os shares SMB e o cenario mais provavel de perda massiva de dados. Camadas de defesa:

1. **Snapshots ZFS:** o ransomware nao consegue modificar snapshots (sao read-only no filesystem). Rollback instantaneo.
2. **`zfs hold` em snapshots criticos:** previne destruicao acidental ou programatica de snapshots essenciais.
   ```bash
   # Proteger snapshots mensais contra destruicao
   zfs hold critical data/production/raw@backup-20260601
   # Para liberar (requer acao explicita): zfs release critical data/...
   ```
   **Automacao:** criar cron job no TrueNAS (Tasks > Cron Jobs) para aplicar hold automaticamente no primeiro dia de cada mes:
   ```bash
   #!/bin/bash
   # /usr/local/bin/nas-snapshot-hold.sh
   # Aplicar hold em snapshots mensais para prevenir destruicao
   set -euo pipefail

   TAG="monthly-$(date +%Y%m)"
   LOG="/var/log/nas-snapshot-hold.log"

   echo "=== Snapshot hold started $(date) ===" >> "$LOG"

   for dataset in data/production/raw data/production/projects data/broll data/audio; do
     # Pegar o snapshot diario mais recente deste dataset
     SNAP=$(zfs list -t snapshot -o name -s creation -H "$dataset" 2>/dev/null | tail -1)
     if [ -n "$SNAP" ]; then
       zfs hold "$TAG" "$SNAP" 2>/dev/null && \
         echo "HOLD: $SNAP (tag: $TAG)" >> "$LOG" || \
         echo "SKIP: $SNAP (ja tem hold ou nao existe)" >> "$LOG"
     fi
   done

   # Limpar holds com mais de 6 meses (liberar espaco)
   SIX_MONTHS_AGO=$(date -d '6 months ago' +%Y%m 2>/dev/null || date -v-6m +%Y%m)
   for dataset in data/production/raw data/production/projects data/broll data/audio; do
     zfs list -t snapshot -o name -H "$dataset" 2>/dev/null | while read snap; do
       for hold in $(zfs holds -H "$snap" 2>/dev/null | awk '{print $2}'); do
         if [[ "$hold" =~ ^monthly-([0-9]{6})$ ]] && [ "${BASH_REMATCH[1]}" -lt "$SIX_MONTHS_AGO" ]; then
           zfs release "$hold" "$snap" && echo "RELEASE: $snap (tag: $hold, >6 meses)" >> "$LOG"
         fi
       done
     done
   done

   echo "=== Snapshot hold finished $(date) ===" >> "$LOG"
   ```
   Cron: `0 1 1 * *` (todo dia 1, 01:00). Retem holds por 6 meses antes de liberar.
3. **Air-gap do USB:** desconectar o Seagate apos o backup completar. Ransomware nao pode criptografar um drive desconectado.
4. **Versoes no rsync:** o `--backup-dir` preserva arquivos deletados/modificados por 30 dias. Criptografia no source nao destroi versoes anteriores no backup.
5. **Offsite em B2:** copia completamente fora do alcance de malware local. Com Object Lock, imutavel durante o periodo de retencao.
6. **Conta admin separada:** nao usar o mesmo usuario para SMB e administracao do TrueNAS.

### 10i. Criptografia do Seagate

O Seagate 20TB **nao esta criptografado.** Isso significa que roubo fisico do drive expoe todos os dados de backup.

**Se formatado como ZFS:**
```bash
# Criar pool com encryption nativa do ZFS
zpool create -o ashift=12 \
  -O encryption=aes-256-gcm \
  -O keylocation=prompt \
  -O keyformat=passphrase \
  backup /dev/sdX
```

**Se ext4/NTFS:** usar LUKS no Linux ou BitLocker no Windows antes de usar como destino de backup.

### 10j. Criptografia do Pool Principal — Consideracoes

O pool `data` **nao e criptografado.** Isso e uma decisao consciente com trade-offs:

**Por que NAO criptografar agora:**
- ZFS native encryption **nao pode ser habilitada em pool/dataset existente** — seria necessario recriar o pool do zero, copiar tudo de volta
- Performance: AES-NI no Xeon E-2224G mitiga o overhead, mas ha ~3-5% de impacto em escritas sequenciais pesadas (relevante para ingest de video)
- Risco de lock-out: se a passphrase for perdida, os dados sao irrecuperaveis — para um NAS domestico com uma pessoa, o risco de perder a passphrase e maior que o risco de roubo
- O pool esta atras de uma LAN domestica, sem acesso externo (Tailscale e encrypted end-to-end)

**Quando considerar criptografar:**
- Se o NAS for transportado fisicamente (ex: mudanca de casa)
- Se NVMe drives forem enviados para RMA (dados residuais no flash)
- Se o modelo de ameaca mudar (ex: co-working space, escritorio compartilhado)

**Mitigacao para RMA:** antes de enviar um NVMe para garantia:
```bash
# Secure erase via NVMe (se o drive ainda funciona)
nvme format /dev/nvmeXn1 --ses=1  # User data erase
# ou
nvme sanitize /dev/nvmeXn1 -a 2   # Block erase
```

**Se decidir criptografar no futuro (ex: expansao de julho):** o novo mirror vdev pode ter datasets criptografados desde o inicio (`zfs create -o encryption=aes-256-gcm -o keylocation=file:///root/.zfs-key -o keyformat=hex data/sensitive`). Gerar chave: `dd if=/dev/urandom bs=32 count=1 | xxd -p > /root/.zfs-key && chmod 400 /root/.zfs-key`. Permite criptografia seletiva sem recriar o pool.

**Prioridade:** media. Implementar antes de transportar o drive para qualquer local fora de casa.

### 10k. Agendamento de Backup

| Tarefa | Horario | Frequencia |
|--------|---------|-----------|
| Immich PostgreSQL dump | 02:30 | Diario |
| ZFS send/receive (ou rsync) para Seagate | 03:00 | Diario |
| rclone copy — documents + photos para B2 | 04:00 | Diario |
| rclone copy — production/raw para B2 | Sabado 02:00 | Semanal |
| Desconectar Seagate (air-gap manual) | Apos backup confirmar OK | Diario (ideal) |
| Snapshot hold (mensal) | Dia 1, 01:00 | Mensal |

Configurar via TrueNAS: **Tasks > Cron Jobs**. Os scripts de backup ja incluem logging — verificar `/var/log/nas-backup.log` e `/var/log/immich-db-backup.log` semanalmente.

**Monitoramento remoto:** `ssh thiago@100.x.y.z "tail -20 /var/log/nas-backup.log && tail -10 /var/log/immich-db-backup.log && zpool status backup"`

---

## 11. Planejamento de Capacidade e Archival

### 11a. Taxa de Consumo

| Tipo | Tamanho por video | Por semana (4 videos) | Por mes |
|------|-------------------|----------------------|---------|
| Raw footage (4K ~200 Mbps) | ~45 GB | ~180 GB | ~720 GB |
| Exports (4K H.264/H.265) | ~5 GB | ~20 GB | ~80 GB |
| Proxies (1080p H.264) | ~3 GB | ~12 GB | ~48 GB |
| Projetos (.drp + cache) | ~1 GB | ~4 GB | ~16 GB |
| **Total liquido** | | **~216 GB** | **~864 GB** |

Arredondar para ~**800 GB/mes a 1 TB/mes** considerando b-roll, audio e graficos adicionais.

**Overhead de snapshots:** os snapshots ZFS consomem espaco proporcional a taxa de mudanca (copy-on-write). Estimativa para este workflow:

| Dataset | Snapshots ativos | Taxa de mudanca | Overhead estimado |
|---------|-----------------|-----------------|-------------------|
| production/raw | 14 diarios | Quase zero (write-once) | ~1% (~7 GB em 700 GB) |
| production/projects | 24 horarios + 14 diarios | Alta durante edicao ativa | ~15-20% (~2-3 GB por projeto ativo) |
| production/exports | 7 diarios | Baixa (write-once por export) | ~5% (~4 GB em 80 GB) |
| broll, audio, graphics | 14 diarios cada | Incremental, baixa | ~3% (~2 GB total) |
| photos, documents | 30 diarios cada | Baixa-media | ~5% (~3 GB total) |

**Total estimado de overhead de snapshots: ~5-8% do pool** (~180-280 GB em 3.5 TiB). Incluir na projecao de capacidade — na pratica, o espaco "usavel" para novos dados e ~3.2-3.3 TiB (nao 3.5).

Monitorar: `zfs list -o space -t all data` mostra `USEDSNAP` por dataset.

### 11b. Projecao de Capacidade

| Marco | Configuracao do pool | Capacidade usavel | Meses ate 80% | Data estimada |
|-------|---------------------|-------------------|---------------|---------------|
| Agora (jun 2026) | 1x stripe 4TB | ~3.5 TiB | ~3.5 | Set 2026 |
| Segunda-feira | 1x mirror 4TB | ~3.5 TiB | ~3.5 | Out 2026 |
| Julho 2026 | 2x mirror 4TB | ~7 TiB | ~7 | Jan 2027 |

**Alerta critico:** ZFS degrada significativamente acima de 80% de ocupacao. Fragmentacao aumenta, performance de escrita cai, e operacoes de manutencao (scrub, resilver) ficam mais lentas e arriscadas. Tratar 80% como limite operacional.

### 11c. Politica de Archival (Ciclo de Vida)

```
                                                           ┌─────────────┐
┌────────────────────┐    60 dias apos      ┌─────────────┐ │  DELETAVEL  │
│  ATIVO (NVMe)      │ ──publicacao───────> │  ARQUIVADO  │ │  (se YouTube│
│  Edicao, correcoes │                      │  (Seagate)  │ │   still up  │
│  re-edicao         │                      │  Indefinido │ │   e sem     │
└────────────────────┘                      └─────────────┘ │   re-edit)  │
                                                            └─────────────┘
```

> **IMPORTANTE: comecar archival IMEDIATAMENTE.** A janela de 60 dias e medida a partir da **data de publicacao** do video, nao a partir da data de setup do NAS. Se ja existe footage publicado ha mais de 60 dias no pool, arquivar AGORA. Nao esperar o pool chegar a 80% — archival proativo previne emergencias e garante margem para projetos novos.

**Regras de archival:**

1. **Ativo (NVMe):** projetos dos ultimos 60 dias apos publicacao. Periodo de edicao, re-edicao para shorts, correcoes.
2. **Arquivado (Seagate):** apos 60 dias da publicacao, mover **raw footage** para o Seagate. Projetos e exports permanecem no NVMe (sao pequenos).
3. **Deletavel:** apenas se o video esta publicado no YouTube, nao ha plano de re-edit, e o raw foi archivado com sucesso. Na pratica, nunca deletar raw — storage e barato, arrependimento nao.

**Checklist de archival imediato (primeira semana):**
1. Listar raw footage: `find /mnt/data/production/raw -maxdepth 1 -mindepth 1 -type d -printf '%T+ %p\n' | sort`
2. Cruzar com calendario de publicacao dos canais PT e EN — identificar projetos publicados ha >60 dias
3. Executar o script de archival abaixo para os projetos identificados

**Script de archival:**

```bash
#!/bin/bash
# /usr/local/bin/nas-archive.sh
# Mover raw footage com mais de 60 dias para o Seagate
set -euo pipefail

SOURCE="/mnt/data/production/raw"
DEST="/mnt/seagate20tb/archive/raw"
LOG="/var/log/nas-archive.log"
DAYS=60

echo "=== Archival started $(date) ===" >> "$LOG"

# Listar diretorios de projetos com mtime > 60 dias
find "$SOURCE" -maxdepth 1 -mindepth 1 -type d -mtime +${DAYS} | while read dir; do
  BASENAME=$(basename "$dir")
  echo "Archiving: ${BASENAME}" >> "$LOG"

  # Copiar primeiro, deletar depois (nunca mv direto — se falhar, perde dados)
  rsync -avh --checksum "$dir/" "${DEST}/${BASENAME}/" >> "$LOG" 2>&1

  if [ $? -eq 0 ]; then
    # Verificacao dupla: tamanho E contagem de arquivos
    SRC_SIZE=$(du -sb "$dir" | cut -f1)
    DST_SIZE=$(du -sb "${DEST}/${BASENAME}" | cut -f1)
    SRC_COUNT=$(find "$dir" -type f | wc -l)
    DST_COUNT=$(find "${DEST}/${BASENAME}" -type f | wc -l)

    if [ "$SRC_SIZE" -eq "$DST_SIZE" ] && [ "$SRC_COUNT" -eq "$DST_COUNT" ]; then
      # Verificacao por checksum: rsync --checksum --dry-run deve reportar 0 transferencias
      DIFF_COUNT=$(rsync -avh --checksum --dry-run "$dir/" "${DEST}/${BASENAME}/" 2>/dev/null | grep -c "^>" || true)

      if [ "$DIFF_COUNT" -eq 0 ]; then
        rm -rf "$dir"
        echo "OK: ${BASENAME} (${SRC_COUNT} arquivos, ${SRC_SIZE} bytes, checksum OK, removido do NVMe)" >> "$LOG"
      else
        echo "ERRO: ${BASENAME} — ${DIFF_COUNT} arquivo(s) com checksum divergente. NAO removido." >> "$LOG"
      fi
    else
      echo "ERRO: ${BASENAME} — divergencia (src=${SRC_COUNT} arquivos/${SRC_SIZE}B, dst=${DST_COUNT}/${DST_SIZE}B). NAO removido." >> "$LOG"
    fi
  else
    echo "ERRO: rsync falhou para ${BASENAME}. NAO removido." >> "$LOG"
  fi
done

echo "=== Archival finished $(date) ===" >> "$LOG"
```

**Rodar manualmente** no primeiro domingo de cada mes (nao automatizar — decisao de archival merece revisao humana). Porem, na **primeira execucao**, rodar imediatamente para limpar footage antigo acumulado.

**Nota sobre `mtime`:** o script usa a data de modificacao do diretorio (`-mtime +60`), que pode nao corresponder exatamente a data de publicacao. Para maior precisao, cruzar com o calendario de publicacao e executar o script para projetos especificos manualmente.

### 11d. Alertas de Capacidade

Configurar em **System Settings > Alert Settings**:

| Limite | Severidade | Acao |
|--------|-----------|------|
| 70% | Info | Considerar archival. Revisar o que pode ser movido. |
| 80% | Warning | Archival urgente. Mover raw antigo para Seagate. |
| 90% | Critical | Pool em risco. Parar ingestao de novo footage ate liberar espaco. |
| 95% | Emergency | ZFS pode travar operacoes de escrita. Acao imediata. |

**Monitoramento remoto:** `ssh thiago@100.x.y.z "zpool list data && zfs list -o name,used,avail,refer -r data | head -20"`

### 11e. Caminho de Expansao

| Quando | Acao | Capacidade resultante |
|--------|------|----------------------|
| Jun 2026 (agora) | 1x 4TB NVMe (stripe) | ~3.5 TiB |
| Segunda-feira | Adicionar 2o NVMe 4TB, converter para mirror | ~3.5 TiB (mesma, mas redundante) |
| Julho 2026 | 2x mirror vdevs via PLX switch (4x 4TB total) | ~7 TiB |
| Jul-Set 2026 | Archival proativo (raw >60 dias -> Seagate) | Libera ~40-60% do pool |
| 2027+ opcao A | 3o mirror vdev (se PLX suportar) | ~10.5 TiB |
| 2027+ opcao B | Substituir 4TB por 8TB (um mirror por vez) | ~14 TiB |

**Sobre substituicao de drives:** o pool ja tem `autoexpand=on`. Ao substituir ambos os drives de um mirror vdev de 4TB por 8TB (um de cada vez, aguardando resilver entre eles), o vdev expande automaticamente para 8TB. Nao e necessario recriar o pool.

**Slots NVMe disponiveis:**

| Slot | Uso atual | Notas |
|------|-----------|-------|
| M.2 slot 1 (motherboard) | Boot (Kingston NV3 500GB) | Nao mover |
| M.2 slot 2 (motherboard) | Data (4TB NVMe) | Primeiro drive do pool |
| PCIe adapter passivo | 1 de 4 slots funcional (falta parafusos) | Segundo drive do mirror (segunda-feira) |
| PLX switch adapter (julho) | Chegando | 4 slots com bifurcation real. Expansao futura aqui. |

---

## 12. Monitoramento e Manutenção

### 12a. S.M.A.R.T.

Configurar em Storage > Disks > selecionar disco > Manual Test / Periodic Test:

| Teste | Frequência | Horário | Duração esperada |
|-------|-----------|---------|-----------------|
| Short | Diário | 02:00 | ~2 minutos (NVMe) |
| Long | Semanal (domingo) | 03:00 | ~10-30 minutos (NVMe) |

Habilitar alertas para qualquer resultado diferente de `PASSED`. Um disco com teste SMART falhando deve ser substituído — não é questão de "se" vai falhar, mas "quando."

**NVMe específico:** além de SMART, monitorar `Media and Data Integrity Errors` e `Percentage Used`. NVMe com >90% de vida útil consumida deve entrar no plano de substituição.

```bash
# Verificação manual de saúde NVMe
smartctl -a /dev/nvme0n1 | grep -E "Percentage Used|Media and Data Integrity|Critical Warning"
smartctl -a /dev/nvme1n1 | grep -E "Percentage Used|Media and Data Integrity|Critical Warning"
```

**Atributos críticos para monitorar:**

| Atributo NVMe | Valor saudável | Ação se anormal |
|---------------|---------------|-----------------|
| `Critical Warning` | 0x00 | Qualquer bit ativo = investigar imediatamente |
| `Media and Data Integrity Errors` | 0 | >0 = planejar substituição |
| `Percentage Used` | <90% | >90% = comprar substituto, >95% = substituir agora |
| `Available Spare` | >10% | <10% = substituição urgente |
| `Temperature` | <70°C | >70°C = verificar ventilação do case |

### 12b. Scrub ZFS

Configurar em Data Protection > Scrub Tasks:

| Pool | Frequência | Dia | Horário | Threshold | Duração esperada |
|------|-----------|-----|---------|-----------|-----------------|
| `data` | Mensal | 1° domingo do mês | 02:00 | 30 dias | 2-6 horas (4TB NVMe, depende da ocupação) |
| `boot-pool` | Mensal | 1° domingo do mês | 00:30 | 30 dias | <1 minuto |
| `backup` (se ZFS) | Mensal | 2° domingo do mês | 02:00 | 30 dias | 8-24 horas (HDD 20TB é lento) |

**Configuração via UI:** Tasks > Scrub Tasks > Add:
- Pool: `data`
- Threshold: 30 (dias — se o último scrub foi há menos de 30 dias, o scrub agendado é pulado)
- Enabled: marcado

Scrub lê todos os blocos do pool e verifica checksums contra os metadados ZFS. Detecta bit rot, corrupção silenciosa e erros de mídia antes que causem perda de dados. Em um mirror, ZFS repara automaticamente blocos corrompidos usando a cópia boa.

**Não pular scrubs.** É a principal defesa contra corrupção silenciosa.

**Impacto no desempenho:** durante o scrub, o I/O do pool aumenta significativamente. Operações normais continuam funcionando, mas com latência maior. Evitar edição de vídeo ativa durante o scrub. Em NVMe, o impacto é menor que em HDD, mas ainda perceptível com arquivos 4K.

**Verificar resultado do último scrub:**

```bash
zpool status data | grep scan
# Saída esperada:
#   scan: scrub repaired 0B in 02:15:30 with 0 errors on Sun Jun  1 04:15:30 2026
```

**Procedimento se o scrub encontrar erros:**

```
1. Verificar detalhes:
   zpool status -v data

2. Interpretar:
   - "errors: No known data errors"     → OK, tudo limpo
   - "X data errors" + lista de arquivos → corrupção detectada

3. Se houver erros em pool mirror:
   → ZFS já reparou automaticamente usando a cópia boa
   → Verificar se o disco está falhando: smartctl -a /dev/nvmeXn1
   → Se SMART reporta erros crescentes: planejar substituição do NVMe

4. Se houver erros em pool stripe (ANTES do mirror):
   → Identificar arquivo(s) afetado(s) na saída de zpool status -v
   → Tentar ler o arquivo: cat /mnt/data/...  (se I/O error = confirmado corrompido)
   → Restaurar do snapshot: cp /mnt/data/.zfs/snapshot/.../{arquivo} /mnt/data/.../
   → Se snapshot também corrompido: restaurar do Seagate backup
   → Limpar contadores: zpool clear data

5. Se erros persistentes após clear + novo scrub:
   → O NVMe está falhando — iniciar resilver para novo drive
   → Se pool é mirror: zpool replace data nvme-antigo nvme-novo
   → Se pool é stripe: backup completo → recriar pool → restaurar
```

### 12c. Alertas

Configurar em System Settings > Alert Settings > Email:

**SMTP (Gmail como relay):**
```
From: nas-alerts@gmail.com (ou alias configurado)
SMTP Server: smtp.gmail.com
Port: 587
Security: STARTTLS
Username: tnfigueiredotv@gmail.com
Password: App Password (gerar em myaccount.google.com > Security > App passwords)
```

> **Nota:** usar App Password, não a senha da conta. Habilitar 2FA na conta Google primeiro, depois gerar App Password específica para o NAS em "App passwords".

**Alertas a habilitar (todos com severidade WARNING ou superior):**

| Alerta | Por quê | Severidade |
|--------|---------|-----------|
| Pool degraded | Um drive falhou. Redundância perdida. Substituir imediatamente. | CRITICAL |
| SMART failure | Drive falhando. Substituir proativamente. | CRITICAL |
| Space >75% | Archival necessário em breve. | WARNING |
| Space >85% | Archival urgente. | CRITICAL |
| Scrub errors | Corrupção detectada. Investigar. | CRITICAL |
| UPS on battery | Queda de energia. Shutdown pode ocorrer. | WARNING |
| UPS low battery | Shutdown automático iminente. | CRITICAL |
| Replication failed | Backup programado falhou. | WARNING |
| Certificate expiring | Certificado TLS perto do vencimento. | INFO |
| Update available | Atualização de segurança disponível. | INFO |

**Testar alertas:** após configurar, ir em System Settings > Alert Settings > Send Test Alert. Confirmar que o email chegou. Se não chegou, verificar:
- App Password correta (não a senha da conta)
- 2FA habilitado na conta Google
- "Acesso a apps menos seguros" não é mais necessário com App Passwords
- Firewall do router não bloqueando porta 587

### 12d. Dashboard Check Semanal

Script para verificação rápida manual (rodar toda segunda-feira de manhã, horário de Bangkok):

```bash
#!/bin/bash
# /usr/local/bin/nas-healthcheck.sh
# Rodar via SSH ou Shell na Web UI do TrueNAS

echo "╔══════════════════════════════════════╗"
echo "║     NAS Health Check — $(date +%Y-%m-%d)    ║"
echo "╚══════════════════════════════════════╝"

echo ""
echo "━━━ Pool Health ━━━"
zpool status data | head -20

echo ""
echo "━━━ Space Usage ━━━"
zfs list -o name,used,avail,refer,compressratio -r data | head -20

echo ""
echo "━━━ Snapshot Space (top 10 consumers) ━━━"
zfs list -t snapshot -o name,used -s used -r data | tail -10

echo ""
echo "━━━ Last Scrub ━━━"
zpool status data | grep -A 3 "scan:"

echo ""
echo "━━━ SMART Summary ━━━"
for dev in /dev/nvme?n1; do
  echo "--- ${dev} ---"
  smartctl -H "$dev" 2>/dev/null | grep "SMART overall"
  smartctl -a "$dev" 2>/dev/null | grep -E "Percentage Used|Available Spare|Temperature:"
done

echo ""
echo "━━━ UPS Status ━━━"
upsc ups@localhost 2>/dev/null | grep -E "status|charge|runtime" || echo "UPS não configurado"

echo ""
echo "━━━ Tailscale Status ━━━"
tailscale status 2>/dev/null | head -10 || echo "Tailscale não acessível"

echo ""
echo "━━━ Uptime ━━━"
uptime

echo ""
echo "━━━ Backup Log (últimas 5 linhas) ━━━"
tail -5 /var/log/nas-backup.log 2>/dev/null || echo "Sem log de backup"

echo ""
echo "━━━ Temperatura CPU ━━━"
sensors 2>/dev/null | grep -i "core\|package" || echo "lm-sensors não disponível"
```

**Automatizar notificação semanal (opcional):** criar cron job que roda o script e envia o output por email toda segunda-feira às 09:00 (horário de Bangkok = 22:00 domingo em São Paulo):

```bash
# Adicionar via System Settings > Advanced > Cron Jobs
# Comando:
/usr/local/bin/nas-healthcheck.sh | mail -s "NAS Weekly Health — $(date +%Y-%m-%d)" tnfigueiredotv@gmail.com
# Schedule: 0 22 * * 0 (22:00 domingo horário SP = 09:00 segunda Bangkok)
```

### 12e. UPS — Prioridade Crítica

**Comprar esta semana.** Um NAS com `sync=disabled` no dataset `scratch` está especialmente vulnerável a quedas de energia — dados em trânsito no write cache serão perdidos. Mas mesmo datasets com `sync=standard` podem sofrer corrupção de metadados em shutdown abrupto.

**Requisitos mínimos:**

| Critério | Especificação |
|----------|--------------|
| Tipo | Line-interactive (mínimo) ou Online/double-conversion (ideal) |
| Capacidade | 600VA / 360W (suficiente para Xeon E-2224G + NVMe) |
| Runtime | 30-40 minutos com ~80W de carga (NAS real) |
| Interface | RS-232 serial (conector DB-9) |
| Adaptador | Cabo RS-232 (DB-9) para USB (comprar junto com o UPS) |
| Marcas sugeridas | SMS Station II 600VA, APC Back-UPS 600VA, CyberPower VP600E |
| Custo estimado | R$ 400-700 (UPS) + R$ 30-60 (cabo RS-232→USB) |

> **Por que RS-232 e não USB HID?** O UPS escolhido tem porta serial RS-232, não USB. Muitos nobreaks brasileiros (especialmente SMS e NHS) usam RS-232. A comunicação é feita pelo driver `nutdrv_qx` via cabo conversor RS-232→USB.

**Configuração no TrueNAS:**

1. System Settings > Services > UPS
2. UPS Mode: `Master`
3. Driver: **`nutdrv_qx`** (driver serial universal — compatível com a maioria dos nobreaks RS-232)
   - Alternativa: `blazer_ser` (driver mais antigo, mas amplamente compatível com nobreaks brasileiros)
4. Port: **`/dev/ttyUSB0`** (o adaptador RS-232→USB — verificar com `ls -la /dev/ttyUSB*`)
5. Shutdown mode: `UPS reaches low battery`
6. Shutdown timer: 30 segundos (tempo para ZFS flush)
7. Power off UPS: habilitado (evita restart em loop durante queda prolongada)

> **Importante sobre a porta:** se houver múltiplos adaptadores USB-serial conectados (ex: futuro sensor de temperatura), `/dev/ttyUSB0` pode mudar entre reboots. Usar o caminho persistente:
> ```
> Port: /dev/serial/by-id/usb-FTDI_FT232R_USB_UART_XXXXXXXX-if00-port0
> ```
> Descobrir o caminho correto: `ls -la /dev/serial/by-id/`

**Threshold de shutdown: 50% da bateria (não 20%)**

| Razão | Detalhe |
|-------|---------|
| Margem de segurança | A 50%, restam ~15-20 minutos — tempo de sobra para flush ZFS + shutdown |
| Degradação da bateria | Bateria com 1+ ano pode ter 70-80% da capacidade original. 20% real pode ser 6% efetivo |
| Rede elétrica brasileira | Quedas breves (segundos a minutos) são comuns. A 50%, o UPS absorve sem disparar shutdown |
| Tempo de shutdown | TrueNAS precisa de 1-2 minutos para flush do ZFS (especialmente scratch com sync=disabled) + export + poweroff |
| Consequência de errar | Shutdown incompleto = risco de corrupção. Margem conservadora é barata |

**Configurar threshold no NUT:**

```
# /etc/nut/upsmon.conf (editado via TrueNAS UI ou manualmente)
# O campo "Shutdown Command" no TrueNAS controla quando desligar.
# Para forçar shutdown a 50%:
MONITOR ups@localhost 1 upsmon pass master
SHUTDOWNCMD "/sbin/shutdown -h +0"
FINALDELAY 5
```

Na UI do TrueNAS, o campo relevante é `Shutdown Mode` = "UPS reaches low battery". O threshold exato de "low battery" é configurado no driver NUT via `override.battery.charge.low = 50` nos parâmetros auxiliares.

Adicionar em "Auxiliary Parameters (ups.conf)":
```
override.battery.charge.low = 50
```

**Verificar conexão após instalação:**

```bash
# Verificar se o NUT detectou o UPS
upsc ups@localhost

# Saída esperada (campos importantes):
# battery.charge: 100
# battery.runtime: 2400  (segundos)
# ups.status: OL         (OL = On Line, OB = On Battery)
# input.voltage: 120.0
# ups.mfr: SMS
# ups.model: Station II 600VA
```

**Troubleshooting NUT + RS-232:**

| Problema | Diagnóstico | Solução |
|----------|------------|---------|
| `upsc` retorna "Data stale" | Driver não comunicando | Verificar cabo, trocar porta USB, testar `dmesg | grep ttyUSB` |
| `No response from UPS` | Baud rate incorreto | Adicionar `baudrate = 2400` (ou 9600) nos Auxiliary Parameters |
| `/dev/ttyUSB0` não existe | Cabo não reconhecido | `lsusb` para ver se o adaptador aparece. Trocar cabo. |
| `ups.status: FSD` | Forced shutdown em andamento | UPS bateria crítica. Recarregar e reiniciar serviço NUT. |
| Driver `nutdrv_qx` falha | Incompatibilidade | Tentar `blazer_ser` como driver alternativo |

**Testar após instalação:** desligar a tomada do NAS com o UPS conectado. Verificar:
- TrueNAS detecta "on battery" (`upsc ups@localhost | grep status` → `OB`)
- Alerta enviado por email
- Se mantiver desligado: shutdown limpo antes da bateria atingir 50%
- Pool status após religar: `ONLINE`, zero errors

### 12f. BIOS — Restore on AC Power Loss

**ABSOLUTAMENTE CRÍTICO para operação remota.** Se faltar energia e voltar (o que acontece regularmente no Brasil), o NAS precisa ligar automaticamente sem ninguém apertar o botão de power. Sem essa configuração, toda queda de energia exige que o irmão vá até o NAS e aperte o botão — com 10 horas de diferença de fuso, isso pode significar 10+ horas de downtime.

**Configuração:**

```
BIOS > Advanced > PCH Configuration > Restore on AC Power Loss = "Power On"
```

| Opção | Comportamento | Recomendado? |
|-------|--------------|-------------|
| Power Off | NAS permanece desligado após retorno da energia | NÃO — exige botão físico |
| Last State | Liga se estava ligado antes da queda | SIM — funciona para NAS 24/7 |
| **Power On** | **Sempre liga quando a energia retorna** | **SIM — opção mais segura** |

Preferir "Power On" sobre "Last State". Em cenário raro onde alguém desliga o NAS intencionalmente e depois cai a luz, "Last State" não religaria. "Power On" sempre religa, independentemente do estado anterior. Para um NAS que roda 24/7, o comportamento é idêntico na prática, mas "Power On" é mais resiliente.

**Verificar:** após configurar, testar o ciclo completo:
1. NAS ligado e funcionando
2. Puxar o cabo de energia (simulando queda)
3. Esperar 30 segundos
4. Reconectar o cabo
5. NAS deve iniciar automaticamente (boot em ~60-90 segundos)
6. Verificar que pool, shares e Tailscale voltaram sem intervenção

> **Nota sobre UPS + BIOS:** quando o UPS desliga o NAS por bateria baixa E depois a energia retorna, o UPS religa → BIOS detecta AC restored → NAS liga automaticamente. O ciclo completo é automático. Sem a config de BIOS, o UPS religa mas o NAS permanece desligado.

### 12g. Proteção contra Surtos (DPS)

A rede elétrica brasileira é suscetível a picos de tensão causados por raios (especialmente em São Paulo durante o verão) e chaveamento da rede. Um UPS line-interactive sozinho NÃO protege adequadamente contra surtos — a maioria dos modelos line-interactive repassa picos rápidos para o equipamento.

**Proteção recomendada (3 camadas):**

| Camada | Dispositivo | Proteção | Custo estimado |
|--------|------------|----------|---------------|
| 1 — Quadro elétrico | DPS (Dispositivo de Proteção contra Surtos) classe II | Surtos da rede externa (raios, manobras) | R$ 100-200 (instalação por eletricista) |
| 2 — Tomada | Filtro de linha com supressão de surtos | Surtos residuais que passam pelo DPS | R$ 50-100 |
| 3 — Equipamento | UPS line-interactive | Estabilização de tensão + bateria | R$ 400-700 |

**Ordem de conexão na tomada:**

```
Tomada → DPS (no quadro) → Filtro de linha → UPS → NAS
```

**Produtos recomendados (mercado brasileiro):**
- DPS classe II: Clamper VCL 275V 20kA (instalação no quadro por eletricista)
- Filtro de linha: Clamper iClamper Energia 8 (≥1000J de absorção de surto)
- Evitar filtros de linha genéricos sem especificação de Joules

**O que proteger além do NAS:**
- Roteador/modem (se queimar, perde acesso remoto)
- Seagate 20TB USB (se queimar, perde o backup local)
- Ambos devem estar no mesmo filtro de linha ou em filtro separado

> **Atenção:** DPS no quadro elétrico requer instalação por eletricista certificado. É investimento baixo (R$ 100-200 incluindo mão de obra) com retorno altíssimo — um surto pode destruir NAS + UPS + drives de uma vez, causando perda de R$ 5.000+ em hardware e dados potencialmente insubstituíveis.

---

## 13. Segurança e Hardening

### 13a. IPMI/BMC — Risco Crítico e Vantagem Estratégica

O Supermicro X11SCL-IF expõe a interface BMC (Baseboard Management Controller) em `192.168.18.249`. O BMC permite controle total do hardware remotamente: ligar, desligar, acessar console KVM, montar mídia virtual, acessar BIOS. Na rede principal, qualquer dispositivo comprometido pode acessá-lo.

**Histórico de CVEs Supermicro BMC:** múltiplas vulnerabilidades de execução remota de código (RCE) foram reportadas ao longo dos anos. Um BMC com firmware desatualizado e credenciais padrão é um vetor de ataque severo.

**Ações imediatas (fazer hoje):**

| # | Ação | Como |
|---|------|------|
| 1 | Trocar senha padrão | Acessar `https://192.168.18.249` > Configuration > Users > alterar ADMIN. Senha 20+ chars, gerada, única. |
| 2 | Atualizar firmware BMC | Baixar última versão em supermicro.com > Support > BMC Firmware > X11SCL-IF. Aplicar via web UI > Maintenance > Firmware Update. |
| 3 | Forçar HTTPS | Configuration > Network > Web > HTTPS only. Desabilitar HTTP. |
| 4 | Desabilitar serviços não usados | Configuration > Network > desabilitar SNMP, SMTP, Serial-over-LAN, Virtual Media (a menos que use ativamente). |
| 5 | Bloquear acesso externo | No router: criar regra de firewall que permite acesso a 192.168.18.249 **apenas** de IPs conhecidos. |

**IPMI via Tailscale — vantagem para operação remota:**

Como o NAS já anuncia a subnet `192.168.18.0/24` via Tailscale (subnet routing), o IPMI em `192.168.18.249` é acessível remotamente de qualquer dispositivo na tailnet. Isso é uma **vantagem enorme** para administração remota desde Bangkok:

| Capacidade | Sem IPMI | Com IPMI via Tailscale |
|-----------|---------|----------------------|
| NAS travou (kernel panic) | Irmão precisa segurar botão de power 5s + religar | Acesso remoto: power cycle via IPMI |
| Precisa acessar BIOS | Irmão precisa conectar monitor + teclado | Console KVM remoto via browser |
| TrueNAS não bootou | Irmão precisa descrever tela por WhatsApp | Vê a tela exata via KVM |
| NAS desligado e BIOS não auto-liga | Sem solução remota | Power On via IPMI |

**Testar acesso IPMI via Tailscale:**
1. Conectar ao Tailscale pelo celular (4G, NÃO Wi-Fi de casa)
2. No browser: `https://192.168.18.249`
3. Login com credenciais do BMC
4. Testar: Remote Control > Console Redirection (KVM)
5. Testar: Power Control > Power On / Power Off / Reset

**Segurança do IPMI na tailnet — Tailscale ACLs:**

```jsonc
// Restringir IPMI apenas para o owner — NUNCA para editor
{
  "acls": [
    {
      "action": "accept",
      "src": ["tag:owner"],
      "dst": ["192.168.18.249:443"]  // IPMI HTTPS
    }
    // editor NÃO tem acesso ao IPMI
  ]
}
```

> **Atualizar firmware BMC ANTES de expor via Tailscale.** Um BMC com CVEs conhecidos exposto na tailnet é um risco inaceitável. Atualizar primeiro, testar acesso depois.

**Ação ideal (futuro, quando tiver managed switch):**

Isolar BMC em VLAN dedicada. O Supermicro X11SCL-IF tem porta de rede BMC dedicada (pode ser a mesma porta compartilhada via "failover" — verificar jumper `JPB1` na placa). Com um managed switch, criar VLAN 99 para BMC e VLAN 1 para dados.

### 13b. TrueNAS Web UI

| # | Ação | Detalhe |
|---|------|--------|
| 1 | HTTPS obrigatório | System Settings > General > GUI > HTTP → HTTPS Redirect: habilitado |
| 2 | Senha forte | 20+ chars, gerada, armazenada em gerenciador de senhas |
| 3 | 2FA (TOTP) | Credentials > 2FA > habilitar com app autenticador (Authy, 1Password, etc.) |
| 4 | Conta admin separada | Criar usuário admin (não root) para operações diárias. Root apenas para emergência. |
| 5 | Restringir IP | Se o router suportar: permitir porta 443 do NAS apenas para IPs conhecidos |

> **Nota sobre 2FA e acesso remoto:** se perder o dispositivo autenticador (ex: celular roubado na Tailândia), o acesso ao TrueNAS fica bloqueado. Mitigações:
> - Salvar backup codes do 2FA no gerenciador de senhas
> - IPMI permite acesso ao console mesmo sem 2FA (reset de emergência)
> - Manter uma sessão SSH com chave pública como alternativa

### 13c. Exportação de Configuração

A configuração do TrueNAS é o "código-fonte" da infraestrutura. Perder a config significa recriar tudo manualmente — pools, shares, permissões, alertas, jobs, ACLs.

**Procedimento:**
1. System Settings > General > Save Config (incluir senha: marcar "Export Password Secret Seed")
2. O arquivo `.tar` contém tudo: pools, shares, users, services, cron jobs
3. Salvar em pelo menos 3 locais fora do NAS:
   - Email para si mesmo (draft permanente no Gmail)
   - Backblaze B2 (junto com backups de dados)
   - Seagate 20TB (pasta `config-backups/`)
   - Gerenciador de senhas (anexo seguro, se suportado)

**Quando exportar:** após qualquer mudança significativa — novo share, novo user, novo app, mudança de rede, novo cron job, alteração de ACL.

**Naming convention para backups de config:**
```
truenas-config-YYYY-MM-DD-descricao.tar
# Exemplos:
truenas-config-2026-06-13-initial-setup.tar
truenas-config-2026-06-16-mirror-conversion.tar
truenas-config-2026-06-20-pre-departure.tar
```

**Restore:** System Settings > General > Upload Config. O pool ZFS é importado separadamente (`zpool import`). A config restaura tudo exceto os dados em si.

### 13d. Segurança de Rede

| Verificação | Status | Ação |
|------------|--------|------|
| Wi-Fi do irmão | Verificar | WPA3 (ou WPA2-AES mínimo), senha 20+ chars |
| Router firmware | Verificar | Atualizar para última versão |
| UPnP | Verificar | Desabilitar no router (port forwarding automático é vetor de ataque) |
| Port forwarding | Não deve existir | Tailscale elimina necessidade de qualquer porta aberta |
| DNS | Considerar | DNS over HTTPS (1.1.1.1 ou 8.8.8.8) no router |
| WPS | Desabilitar | Wi-Fi Protected Setup é vulnerável a brute force |
| Rede guest | Considerar | Separar dispositivos IoT do irmão da rede principal |

> **Sobre Tailscale e zero port forwarding:** o modelo de segurança deste setup depende de que NENHUMA porta do NAS esteja exposta à internet pública. Todo acesso remoto passa pela tailnet (WireGuard criptografado, autenticação mútua). Se alguém configurar port forwarding no router (ex: para um jogo ou serviço), a superfície de ataque aumenta. Instruir o irmão a não mexer nas configurações do router.

### 13e. Checklist de Hardening

```
IPMI/BMC
[ ] Senha trocada (não ADMIN/ADMIN)
[ ] Firmware atualizado (verificar data da versão instalada)
[ ] HTTPS only habilitado
[ ] Serviços desnecessários desabilitados (SNMP, SMTP, SoL, Virtual Media)
[ ] Acesso testado via Tailscale (de fora da rede local)
[ ] ACL do Tailscale restringe IPMI a tag:owner

TRUENAS
[ ] HTTPS redirect habilitado
[ ] 2FA habilitado (backup codes salvos)
[ ] Senha forte (20+ chars)
[ ] Conta admin separada (root apenas emergência)

SMB
[ ] Minimum protocol = SMB3
[ ] Server signing = required
[ ] SMBv1 desabilitado
[ ] Encryption = required nos shares sensíveis
[ ] Guest access desabilitado
[ ] Conta editor desabilitada quando não em uso

REDE
[ ] UPnP desabilitado no router
[ ] Router firmware atualizado
[ ] WPS desabilitado
[ ] Nenhum port forwarding ativo
[ ] Wi-Fi com WPA3 (ou WPA2-AES) e senha forte
[ ] DNS over HTTPS configurado

DADOS
[ ] Config TrueNAS exportada e salva offsite (email + B2 + Seagate)
[ ] Seagate: criptografia habilitada (ZFS native ou LUKS)

BIOS
[ ] Restore on AC Power Loss = "Power On"
[ ] Senha de BIOS configurada (impede alterações locais acidentais)
```

---

## 14. Disaster Recovery

### 14a. Cenários e Tempos de Recuperação

| # | Cenário | RPO (dados perdidos) | RTO (downtime) | Procedimento resumido | Ação remota? |
|---|---------|---------------------|----------------|----------------------|-------------|
| 1 | **1 NVMe falha** (mirror ativo) | Zero | Zero (pool opera degradado) | Substituir drive → resilver (~1-2h para 4TB NVMe) | Parcial — irmão instala drive físico |
| 2 | **Ambos NVMe falham** (simultâneo) | Até 24h (último backup) | Horas (compra) + horas (restore) | Comprar drives, instalar TrueNAS, restaurar do Seagate | Não — requer presença física |
| 3 | **Hardware falha** (mobo, PSU, RAM) | Zero (se pool intacto) | Dias (compra de hardware) | Instalar drives no hardware novo, `zpool import data` | Não — requer presença física |
| 4 | **Perda total** (incêndio, roubo) | Último offsite (B2) | Dias a semanas | Sem offsite = **irrecuperável**. Com B2 = download + rebuild | N/A |
| 5 | **Ransomware** via SMB | Último snapshot limpo | Minutos a horas | Identificar datasets afetados, rollback de snapshots | Sim — 100% remoto |
| 6 | **Corrupção de projeto** (.drp) | Último snapshot horário | Minutos | Copiar de `.zfs/snapshot/` | Sim — 100% remoto |
| 7 | **Deleção acidental** de raw | Último snapshot diário | Minutos | Copiar de `.zfs/snapshot/` ou restaurar do backup | Sim — 100% remoto |
| 8 | **Falha do Seagate** | Irrelevante (é cópia) | Até compra de novo drive | Comprar novo drive, refazer full backup | Parcial — irmão conecta drive |
| 9 | **Boot drive falha** | Zero (dados no pool separado) | 1-2h | Reinstalar TrueNAS em novo SSD, importar pool e config | Parcial — irmão instala SSD |
| 10 | **Queda de energia prolongada** (>40min) | Últimos writes em scratch | Minutos após retorno | UPS desliga NAS limpo → BIOS auto-liga quando energia retorna | Sim — automático |
| 11 | **Internet cai na casa do irmão** | Zero | Até ISP resolver | NAS continua operando, apenas perde acesso remoto. Irmão reinicia router. | Parcial — irmão reinicia router |
| 12 | **Tailscale key expira** | Zero | Até renovação | Se key expira, NAS sai da tailnet. Requer acesso local ou IPMI para renovar. | Ver seção 18 |

### 14b. Procedimento de Rebuild Completo

Se o NAS precisa ser reconstruído do zero (hardware novo ou reinstalação):

```
PASSO 1 — Instalar TrueNAS SCALE
  └─ Boot USB com imagem do TrueNAS
  └─ Instalar no boot drive (Kingston NV3 500GB ou substituto)

PASSO 2 — Importar configuração
  └─ System Settings > General > Upload Config
  └─ Usar arquivo .tar salvo offsite (email, B2 ou Seagate)
  └─ Isso restaura: users, shares, services, cron jobs, alertas

PASSO 3 — Importar pool (se os drives de dados sobreviveram)
  └─ Storage > Import Pool > selecionar "data"
  └─ ZFS reconstrói tudo automaticamente a partir dos metadados no disco
  └─ Verificar: zpool status data → ONLINE, no errors

PASSO 4 — Restaurar do backup (se pool perdido)
  └─ Criar novo pool: Storage > Create Pool
  └─ Criar datasets conforme seção 5 do documento
  └─ Conectar Seagate e restaurar:

  # Se backup é ZFS:
  zfs send -R backup/production@latest | zfs receive -F data/production
  zfs send -R backup/photos@latest | zfs receive -F data/photos
  # (repetir para cada dataset)

  # Se backup é rsync:
  rsync -avh /mnt/seagate20tb/production/ /mnt/data/production/
  rsync -avh /mnt/seagate20tb/photos/ /mnt/data/photos/
  # (repetir para cada dataset)

PASSO 5 — Recriar serviços (se config não foi importada)
  └─ SMB shares com permissões (seção 8)
  └─ Periodic snapshot tasks (seção 10g)
  └─ Scrub tasks (seção 12b)
  └─ Alert settings + email (seção 12c)
  └─ UPS configuration (seção 12e)
  └─ BIOS: Restore on AC Power Loss = Power On (seção 12f)

PASSO 6 — Reinstalar apps
  └─ Tailscale: Apps > instalar > autenticar na tailnet
  └─ Immich: Apps > instalar > apontar para data/photos
  └─ Jellyfin: Apps > instalar > apontar para data/media
  └─ Uptime Kuma, Scrutiny, Homepage, etc.

PASSO 7 — Validação
  └─ Acessar cada share SMB do Mac
  └─ Verificar permissões (thiago: R+W, editor: conforme matriz)
  └─ Verificar snapshots criando e recuperando arquivo de teste
  └─ Verificar alertas enviando email de teste
  └─ Verificar Tailscale: ping do celular (4G) → NAS
  └─ Verificar IPMI: acesso via Tailscale
  └─ Verificar UPS: upsc ups@localhost
```

### 14c. Checklist de Verificação Mensal

Rodar no primeiro domingo de cada mês, junto com o scrub:

```
DADOS E BACKUP
[ ] Config TrueNAS exportada e salva offsite (email + B2)
[ ] Backup local (Seagate) rodou sem erros — verificar /var/log/nas-backup.log
[ ] Offsite (B2) sincronizado — verificar dashboard B2 ou rclone log
[ ] Teste de restore: recuperar 1 arquivo do snapshot
[ ] Teste de restore: recuperar 1 arquivo do backup Seagate

HARDWARE
[ ] SMART tests passando em todos os drives (Storage > Disks)
[ ] Pool status: ONLINE, zero errors (zpool status data)
[ ] Temperatura dos drives normal (<70°C para NVMe)
[ ] UPS battery health OK (upsc ups@localhost → battery.charge)
[ ] UPS teste: simulação breve de queda (opcional, a cada 3 meses)

CAPACIDADE
[ ] Espaço disponível > 20% (zfs list data)
[ ] Snapshot space não crescendo descontroladamente
[ ] Se > 70%: planejar archival para Seagate

SEGURANÇA
[ ] Conta editor desabilitada (se não em uso ativo)
[ ] Firmware BMC: verificar se há atualização no site da Supermicro
[ ] Verificar logs de auditoria SMB para atividade suspeita
[ ] Tailscale: NAS aparece como "Connected" no admin console

ACESSO REMOTO
[ ] Tailscale ping do celular (4G) para o NAS: latência aceitável
[ ] IPMI acessível via Tailscale
[ ] TrueNAS Web UI acessível via Tailscale
```

**Tempo estimado:** 15-20 minutos. Agendar lembrete recorrente no calendário (domingo, 10:00 Bangkok = 23:00 sábado SP).

### 14d. Restore de Offsite (Backblaze B2)

Cenário: perda total do NAS e do Seagate. Apenas o B2 sobrevive.

```bash
# 1. Instalar TrueNAS em hardware novo
# 2. Criar pool e datasets (seção 5)
# 3. Instalar rclone

apt install rclone
rclone config  # re-configurar credenciais B2

# 4. Download dos dados (limitado pela conexão de internet)

# Prioridade 1 — dados insubstituíveis:
rclone copy b2:nas-backup-thiago/documents/ /mnt/data/documents/ \
  --progress --transfers 4 --log-file /var/log/rclone-restore.log

rclone copy b2:nas-backup-thiago/photos/ /mnt/data/photos/ \
  --progress --transfers 4 --log-file /var/log/rclone-restore.log

# Prioridade 2 — footage (maior volume):
rclone copy b2:nas-backup-thiago/production-raw/ /mnt/data/production/raw/ \
  --progress --transfers 4 --log-file /var/log/rclone-restore.log

# Tempo estimado para 2TB a 20 Mbps: ~9 dias
# Considerar: download parcial (documents + photos primeiro, raw depois)
# Se na Tailândia: internet local pode ser mais rápida (100+ Mbps em Bangkok)
```

### 14e. Portabilidade do ZFS

Todos os dados residem em datasets ZFS padrão. O pool ZFS é independente do sistema operacional — ele carrega seus próprios metadados nos drives. Isso significa portabilidade total:

| Plataforma de destino | Procedimento |
|----------------------|--------------|
| Outro TrueNAS | `zpool import data` — tudo funciona imediatamente |
| Proxmox | Instalar ZFS, `zpool import data` |
| Ubuntu/Debian | `apt install zfsutils-linux`, `zpool import data` |
| Unraid | Plugin ZFS, `zpool import data` |
| FreeBSD | Suporte nativo, `zpool import data` |

**O que migra automaticamente:** todos os datasets, dados, snapshots, propriedades ZFS (compression, quota, recordsize).

**O que precisa ser recriado:** shares SMB, usuários locais, ACLs de permissão, apps, cron jobs, alertas. Por isso a exportação da config do TrueNAS é essencial — mas mesmo sem ela, os **dados** sobrevivem a qualquer troca de plataforma.

---

## 15. Guia de Emergência do Irmão

> **Este guia deve ser impresso, plastificado e colado na parede ao lado do NAS.**
> Escrito em linguagem simples — sem termos técnicos. O irmão não precisa entender
> como funciona, só precisa seguir os passos.

---

### O que é cada equipamento

```
┌─────────────────────────────────────────────────┐
│  NOBREAK (UPS)                                  │
│  Caixa que fica entre a tomada e o NAS.         │
│  Mantém o NAS ligado por alguns minutos se       │
│  faltar energia. Pode apitar quando cai a luz.  │
├─────────────────────────────────────────────────┤
│  NAS (Servidor)                                 │
│  Caixa maior, com luzes na frente.              │
│  Guarda todos os arquivos de trabalho do        │
│  Thiago. Funciona sozinho, 24 horas por dia.    │
├─────────────────────────────────────────────────┤
│  ROTEADOR                                       │
│  Aparelho da internet (Wi-Fi).                  │
│  Sem internet, o Thiago perde acesso ao NAS.    │
└─────────────────────────────────────────────────┘
```

---

### Situação 1: As luzes do NAS estão apagadas

**O que aconteceu:** caiu a energia e o NAS não ligou sozinho quando a luz voltou. Isso não deveria acontecer (ele é configurado para ligar sozinho), mas pode acontecer em queda muito longa.

**O que fazer:**

1. Verificar se o nobreak (UPS) está ligado — ele tem uma luz ou visor que mostra que está funcionando
2. Se o nobreak estiver desligado, apertar o botão de ligar do nobreak
3. Esperar 1 minuto
4. Procurar o botão de ligar do NAS (fica na **frente** da caixa, normalmente no canto)
5. Apertar **uma vez** e soltar
6. Esperar **5 minutos** — o NAS demora para ligar, é normal
7. Se luzes acenderem na frente → funcionou. Mandar mensagem para o Thiago: "NAS ligou"
8. Se nada aconteceu → verificar se o cabo de energia está bem conectado (atrás do NAS e na tomada/nobreak)
9. Se mesmo assim não ligar → mandar mensagem para o Thiago com uma foto da parte de trás do NAS mostrando os cabos

> **Nunca apertar o botão de ligar por mais de 1 segundo.** Apertar e soltar rápido.
> Segurar o botão por 5+ segundos desliga o NAS à força (ruim para os arquivos).

---

### Situação 2: O NAS ou o nobreak está apitando

**O que aconteceu:** provavelmente caiu a energia e o nobreak está avisando que está funcionando na bateria.

**O que fazer:**

1. Verificar se a luz da casa está funcionando — acender uma lâmpada em outro cômodo
2. Se a luz da casa está funcionando mas o nobreak apita → pode ser problema na tomada. Verificar se o plug está bem encaixado
3. Se a luz da casa está apagada → é queda de energia normal. O nobreak vai manter o NAS ligado por alguns minutos. **Não precisa fazer nada**
4. Se a energia não voltar em 30 minutos, o NAS vai desligar sozinho de forma segura — isso é normal e esperado
5. Quando a energia voltar, o NAS liga sozinho (ver Situação 1 se não ligar)
6. **Mandar mensagem para o Thiago** com vídeo curto mostrando o que está acontecendo (som do apito, luzes)

> **NUNCA desligar o nobreak puxando o cabo enquanto ele está apitando.**
> O nobreak está mantendo o NAS funcionando — desligar ele agora é como puxar o cabo do NAS.

---

### Situação 3: Thiago pediu para desligar o NAS

**O que fazer:**

1. **NÃO puxar nenhum cabo e NÃO apertar nenhum botão ainda**
2. O Thiago vai desligar o NAS remotamente pelo computador dele
3. Esperar ele confirmar: "pode desligar o nobreak agora"
4. Depois que ele confirmar E as luzes do NAS estiverem apagadas:
   - Apertar o botão de desligar do nobreak
   - Ou: se o Thiago pedir, desconectar da tomada
5. Para religar depois: conectar na tomada → ligar nobreak → ligar NAS (ver Situação 1)

> **Ordem sempre:** primeiro o Thiago desliga pelo software, depois desliga no botão/tomada.
> Nunca ao contrário. Puxar o cabo com o NAS ligado pode danificar arquivos.

---

### Situação 4: A internet caiu

**O que aconteceu:** o Thiago não consegue acessar o NAS remotamente.

**O que fazer:**

1. Verificar se o Wi-Fi do celular está funcionando
2. Se o Wi-Fi não funciona para ninguém em casa → reiniciar o roteador:
   - Desligar o roteador da tomada
   - Esperar **30 segundos** (contar até 30)
   - Ligar novamente na tomada
   - Esperar **3 minutos** para voltar a funcionar
3. Testar o Wi-Fi no celular
4. Se voltou → avisar o Thiago: "Internet voltou"
5. Se NÃO voltou depois de 10 minutos → ligar para a operadora de internet e informar que está sem conexão
6. Avisar o Thiago do resultado

> **O NAS continua funcionando sem internet.** Ele não perde nenhum arquivo. Só perde
> o acesso remoto do Thiago. Não precisa mexer no NAS quando a internet cai.

---

### Situação 5: Thiago pediu para trocar/mexer em algo no NAS

**Regras:**

1. Só mexer se o Thiago pediu **E** está em chamada de vídeo (WhatsApp/FaceTime) guiando ao vivo
2. Nunca desconectar cabos por conta própria
3. Se o Thiago pedir para trocar um HD ou SSD:
   - Ele vai mostrar exatamente qual peça mexer
   - Ele vai desligar o NAS remotamente primeiro
   - Só depois que estiver desligado, mexer na peça
4. Depois de mexer, religar conforme Situação 1

---

### Informações de contato

| Info | Valor |
|------|-------|
| **WhatsApp do Thiago** | [preencher antes de imprimir] |
| **Fuso horário** | Quando são **8h da manhã** em SP, são **19h** em Bangkok |
| **Melhor horário para ligar** | Entre 8h-12h de SP (19h-23h Bangkok) |
| **Em emergência** | Mandar mensagem **E** ligar. Mesmo de madrugada. |

---

### O que NÃO fazer (NUNCA)

- **NÃO** mexer no NAS sem falar com o Thiago primeiro
- **NÃO** desligar puxando o cabo — sempre apertar botão ou esperar o Thiago desligar
- **NÃO** conectar pendrive, HD externo ou qualquer dispositivo USB sem autorização
- **NÃO** mover o NAS de lugar (os cabos podem soltar)
- **NÃO** colocar coisas em cima do NAS ou do nobreak (esquentam e precisam de ventilação)
- **NÃO** dar a senha do Wi-Fi para técnicos sem avisar o Thiago
- **NÃO** deixar técnicos mexerem no NAS — eles podem mexer no roteador se precisar, mas não no NAS

---

## 16. Diagrama de Rede

### 16a. Topologia Física e Lógica

```
                            ┌──────────────────┐
                            │     INTERNET     │
                            └────────┬─────────┘
                                     │
                            ┌────────▼─────────┐
                            │  ROUTER / MODEM  │
                            │  192.168.18.1    │
                            └──┬──┬──┬─────────┘
                               │  │  │
              ┌────────────────┘  │  └────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
   ┌──────────────────┐  ┌───────────────┐  ┌────────────────┐
   │  NAS — Porta 1   │  │ NAS — Porta 2 │  │   NAS — IPMI   │
   │  (i210 #1)       │  │ (i210 #2)     │  │   (BMC)        │
   │  192.168.18.250  │  │ 192.168.18.251│  │ 192.168.18.249 │
   │                  │  │               │  │                │
   │  ┌─ SMB (445)    │  │ SMB Multi-    │  │ ┌─ Web UI (443)│
   │  ├─ Web UI (443) │  │ channel       │  │ ├─ KVM Console │
   │  ├─ SSH (22)     │  │ (agregação)   │  │ ├─ Power Ctrl  │
   │  ├─ Immich (2283)│  │               │  │ └─ BIOS Access │
   │  └─ Tailscale    │  │               │  │                │
   │    (100.x.y.z)   │  └───────────────┘  └────────────────┘
   └──────────────────┘

USB:
   NAS ◄────── USB 3.0 ──────► Seagate 20TB (pool "backup")
   NAS ◄────── RS-232→USB ───► Nobreak/UPS (monitoramento NUT)

Tailscale Mesh VPN (WireGuard):
   ┌──────────────┐         ┌──────────────────────┐
   │   NAS        │◄═══════►│  Mac do Thiago       │
   │  100.x.y.z   │  tunnel │  (Bangkok, Tailândia)│
   │              │         │  100.a.b.c           │
   │  subnet:     │         └──────────────────────┘
   │  192.168.18  │         ┌──────────────────────┐
   │  .0/24       │◄═══════►│  Mac do Editor       │
   │              │  tunnel │  100.d.e.f           │
   │              │         └──────────────────────┘
   │              │         ┌──────────────────────┐
   │              │◄═══════►│  iPhone do Thiago    │
   │              │  tunnel │  100.g.h.i           │
   └──────────────┘         └──────────────────────┘
```

### 16b. Tabela de IPs e Portas

| Dispositivo | IP local | IP Tailscale | Função |
|------------|----------|-------------|--------|
| Router/Modem | 192.168.18.1 | — | Gateway, DHCP, Wi-Fi |
| NAS porta 1 | 192.168.18.250 | 100.x.y.z | Dados, serviços, Tailscale |
| NAS porta 2 | 192.168.18.251 | — | SMB Multichannel (agregação) |
| NAS IPMI/BMC | 192.168.18.249 | — (via subnet routing) | Gestão remota de hardware |
| Mac Thiago | — | 100.a.b.c | Administração, edição |
| Mac Editor | — | 100.d.e.f | Edição de vídeo |
| iPhone Thiago | — | 100.g.h.i | Monitoramento mobile |

### 16c. Portas e Serviços

| Porta | Protocolo | Serviço | Acesso |
|-------|----------|---------|--------|
| 22 | TCP | SSH | Tailscale only (admin) |
| 443 | TCP | TrueNAS Web UI (HTTPS) | Tailscale only (admin) |
| 445 | TCP | SMB shares | LAN + Tailscale |
| 2283 | TCP | Immich (fotos) | Tailscale only |
| 3001 | TCP | Uptime Kuma (monitoramento) | Tailscale only |
| 8080 | TCP | Homepage (dashboard) | Tailscale only |
| 8096 | TCP | Jellyfin (mídia) | Tailscale only |
| 8384 | TCP | Syncthing (sync) | Tailscale only |
| 8989 | TCP | Speedtest Tracker | Tailscale only |

> **Regra fundamental:** NENHUMA dessas portas é exposta à internet pública. Todo acesso
> externo passa exclusivamente pela tailnet. O router não tem port forwarding configurado.

### 16d. Fluxo de Dados — Edição de Vídeo Remota

```
Bangkok (Thiago)                    São Paulo (NAS)
┌─────────────┐                     ┌─────────────┐
│  DaVinci    │                     │  SMB Share   │
│  Resolve    │ ◄── Tailscale ────► │  production/ │
│             │     (~5-20 MB/s     │  ├── raw/    │
│  Proxies    │      via WAN)       │  ├── projects│
│  locais     │                     │  ├── exports/│
│             │                     │  └── scratch/│
└─────────────┘                     └─────────────┘

Fluxo típico:
1. Copiar proxies do NAS → Mac local (via Tailscale, overnight)
2. Editar localmente com proxies
3. Subir projeto (.drp) para NAS
4. Renderizar no Mac (ou futuro: no NAS com Jellyfin/ffmpeg)
```

---

## 17. Checklist Pré-Partida para Tailândia

> Tudo que precisa ser feito e verificado ANTES de embarcar.
> Cada item marcado significa "testado e funcionando".
> Não viajar com itens desmarcados nas categorias CRÍTICO.

### 17a. Hardware (CRÍTICO)

```
[ ] 2° NVMe instalado no adaptador PCIe
[ ] Mirror conversion concluída (zpool status data → mirror-0)
[ ] Resilver finalizado sem erros
[ ] UPS instalado e conectado entre tomada e NAS
[ ] UPS testado: desconectar tomada, verificar que NAS continua ligado
[ ] UPS testado: manter desconectado até 50% → NAS desliga limpo
[ ] UPS testado: reconectar tomada → NAS liga automaticamente (BIOS)
[ ] Cabo RS-232→USB conectado entre UPS e NAS
[ ] NUT comunicando: upsc ups@localhost retorna dados
[ ] BIOS: Restore on AC Power Loss = "Power On" (verificar e testar)
[ ] DPS/surge protector instalado (filtro de linha com proteção contra surtos)
[ ] Seagate 20TB conectado e montado (zpool status backup → ONLINE)
[ ] Todos os cabos organizados (zip ties / organização)
[ ] Etiquetas físicas em todos os cabos e dispositivos
[ ] Ventilação ao redor do NAS e UPS livre (nada em cima ou bloqueando)
```

### 17b. Software (CRÍTICO)

```
[ ] TrueNAS config exportada e salva em:
    [ ] Email (draft no Gmail)
    [ ] Backblaze B2
    [ ] Seagate 20TB (pasta config-backups/)
    [ ] Gerenciador de senhas (anexo)
[ ] Todos os apps instalados e funcionando:
    [ ] Tailscale (conectado à tailnet)
    [ ] Immich (fotos sincronizando)
    [ ] Uptime Kuma (monitorando NAS + router)
    [ ] Scrutiny (S.M.A.R.T. dashboards)
    [ ] Jellyfin (mídia acessível)
    [ ] Syncthing (sync configurado)
    [ ] Homepage (dashboard centralizado)
[ ] Tailscale key: expiração desabilitada ou >12 meses (ver seção 18)
[ ] Scrub manual executado com sucesso (zpool scrub data → sem erros)
[ ] SMART Long test executado em TODOS os drives → PASSED
[ ] Backup completo para Seagate executado e verificado
[ ] B2 offsite configurado e primeira sincronização completa
[ ] Alertas por email configurados e TESTE recebido no Gmail
[ ] Uptime Kuma monitorando de endpoint externo (uptime check)
[ ] Snapshot tasks configurados e funcionando (verificar .zfs/snapshot/)
[ ] NUT shutdown threshold configurado para 50%
[ ] Cron do healthcheck semanal ativo (email toda segunda)
```

### 17c. Acesso Remoto (CRÍTICO)

```
TESTAR TUDO ABAIXO DO CELULAR COM 4G (NÃO WI-FI DE CASA):
[ ] IPMI acessível: https://192.168.18.249 via Tailscale → login OK
[ ] IPMI KVM: console remoto funciona (vê tela do NAS)
[ ] IPMI Power: consegue power cycle via interface web
[ ] TrueNAS Web UI: https://192.168.18.250 via Tailscale → login OK
[ ] SMB shares: montar compartilhamento do Mac via Tailscale → ler/escrever
[ ] SSH: conectar via Tailscale → shell funciona
[ ] Immich: acessar via Tailscale → fotos visíveis

TESTAR CENÁRIO COMPLETO DE EDIÇÃO:
[ ] Editor conecta Tailscale → monta SMB share → abre projeto DaVinci
[ ] Editor lê e escreve arquivos nos shares corretos
[ ] Editor NÃO acessa shares restritos (testar permissão negada)
```

### 17d. Irmão (CRÍTICO)

```
[ ] Guia de emergência impresso e plastificado (seção 15)
[ ] Guia colado na parede ao lado do NAS
[ ] Irmão sabe onde fica o botão de ligar do NAS
[ ] Irmão sabe onde fica o botão do nobreak (UPS)
[ ] Irmão sabe que NÃO deve desligar puxando cabos
[ ] Irmão tem o WhatsApp do Thiago e sabe o fuso horário
[ ] UPS explicado: não colocar coisas em cima, não bloquear ventilação
[ ] Localização do roteador conhecida pelo irmão (para reiniciar se internet cair)

SIMULAÇÃO (fazer junto antes de viajar):
[ ] Thiago sai de casa → simula estar "em Bangkok"
[ ] Desconectar energia do NAS → irmão segue o guia → NAS liga
[ ] Desconectar internet → irmão reinicia roteador → internet volta
[ ] Thiago pede para desligar o NAS → irmão segue procedimento correto
```

### 17e. Baseline e Documentação

```
[ ] Performance baseline gravada (seção 19)
[ ] Screenshot do dashboard TrueNAS salvo
[ ] Saída de zpool status data salva
[ ] Dados SMART de todos os drives salvos
[ ] Saída de upsc ups@localhost salva
[ ] Saída de tailscale status salva
[ ] Todas as senhas no gerenciador de senhas:
    [ ] TrueNAS admin
    [ ] TrueNAS root (emergência)
    [ ] IPMI/BMC
    [ ] Wi-Fi da casa do irmão
    [ ] Conta B2 / rclone
    [ ] Tailscale admin console
    [ ] Gmail App Password (para alertas)
```

---

## 18. Administração do Tailscale

### 18a. Expiração de Chaves — ATENÇÃO CRÍTICA

Por padrão, chaves de máquina no Tailscale expiram após **180 dias** (6 meses). Se a chave do NAS expirar, ele **sai da tailnet silenciosamente** — sem alerta, sem aviso. Todo acesso remoto é perdido instantaneamente.

**Isso significa:** se não desabilitar a expiração antes de ir para Bangkok, em ~6 meses o NAS ficará inacessível remotamente. Reativar exigiria acesso local (irmão + instruções complexas) ou IPMI (se acessível por outro caminho).

**Desabilitar expiração:**

1. Acessar [Tailscale Admin Console](https://login.tailscale.com/admin/machines)
2. Encontrar o NAS na lista de máquinas
3. Clicar nos `...` (três pontos) ao lado do NAS
4. Selecionar **"Disable key expiry"**
5. Confirmar

> **Fazer isso ANTES de viajar.** Verificar que o campo "Key expiry" mostra "Disabled" ou "Does not expire".

**Para todas as máquinas do setup:**

| Máquina | Expiração | Recomendação |
|---------|----------|-------------|
| NAS | Desabilitar | Roda 24/7, não pode perder acesso |
| Mac do Thiago | Manter padrão (180d) | Renova automaticamente quando online |
| iPhone do Thiago | Manter padrão (180d) | Renova automaticamente quando online |
| Mac do Editor | Manter padrão (180d) | Se expirar, editor re-autentica |

### 18b. Auth Key para Reinstalação

Se o Tailscale precisar ser reinstalado no NAS (ex: após reinstalar TrueNAS), será necessária uma auth key para autenticar a máquina na tailnet. Sem ela, seria preciso fazer login interativo — o que exige acesso local ou IPMI.

**Gerar e salvar auth key reusável:**

1. Tailscale Admin Console > Settings > Keys > Generate auth key
2. Configurar:
   - Reusable: **Sim**
   - Ephemeral: **Não** (máquinas efêmeras são removidas ao desconectar)
   - Expiration: **90 dias** (gerar nova quando expirar)
   - Tags: `tag:nas`
3. Copiar a key e salvar no gerenciador de senhas
4. Label: "Tailscale Auth Key — NAS reinstall"

**Uso em reinstalação:**

```bash
# Na shell do TrueNAS (após reinstalar app Tailscale):
tailscale up --auth-key=tskey-auth-XXXXX --advertise-routes=192.168.18.0/24 --accept-dns=false
```

> **Renovar a auth key a cada 90 dias.** Criar lembrete no calendário. Se a key expirar e o Tailscale precisar ser reinstalado, não há como autenticar remotamente.

### 18c. Política de ACL

ACLs (Access Control Lists) controlam quem pode acessar o quê na tailnet. Configurar em Tailscale Admin Console > Access Controls.

**ACL recomendada completa:**

```jsonc
{
  "tagOwners": {
    "tag:owner": ["autogroup:admin"],
    "tag:editor": ["autogroup:admin"],
    "tag:nas": ["autogroup:admin"]
  },

  "acls": [
    // Owner: acesso total ao NAS (todos os serviços + IPMI)
    {
      "action": "accept",
      "src": ["tag:owner"],
      "dst": [
        "tag:nas:*",
        "192.168.18.249:443"
      ]
    },

    // Editor: apenas SMB (porta 445) no NAS
    {
      "action": "accept",
      "src": ["tag:editor"],
      "dst": ["tag:nas:445"]
    },

    // NAS: pode responder a qualquer máquina (necessário para subnet routing)
    {
      "action": "accept",
      "src": ["tag:nas"],
      "dst": ["autogroup:internet:*"]
    }
  ],

  "autoApprovers": {
    "routes": {
      "192.168.18.0/24": ["tag:nas"]
    }
  }
}
```

**Aplicar tags às máquinas:**

| Máquina | Tag | Efeito |
|---------|-----|--------|
| NAS | `tag:nas` | Anuncia subnet, aceita conexões |
| Mac do Thiago | `tag:owner` | Acesso total (SMB, Web UI, SSH, IPMI) |
| iPhone do Thiago | `tag:owner` | Acesso total (monitoramento mobile) |
| Mac do Editor | `tag:editor` | Apenas SMB porta 445 |

### 18d. Subnet Routing

O NAS anuncia a subnet `192.168.18.0/24` via Tailscale. Isso permite que dispositivos na tailnet acessem qualquer IP nessa faixa — incluindo o IPMI em `192.168.18.249`.

**Verificar que subnet routing está ativo:**

```bash
# No NAS:
tailscale status
# Deve mostrar "Subnet routes: 192.168.18.0/24"

# No Mac (Bangkok):
tailscale status
# Deve mostrar o NAS com rotas anunciadas
```

**Aprovar rotas no Admin Console:**
1. Machines > [NAS] > ... > Edit route settings
2. Aprovar `192.168.18.0/24`

> **Sem subnet routing aprovado, o IPMI fica inacessível via Tailscale.** Verificar antes de viajar.

### 18e. MagicDNS

Habilitar MagicDNS para usar nomes amigáveis em vez de IPs:

1. Admin Console > DNS > Enable MagicDNS
2. Após habilitado, acessar o NAS por nome:

```bash
# Em vez de:
ssh admin@100.x.y.z
# Usar:
ssh admin@nas

# Em vez de:
open smb://100.x.y.z/production
# Usar:
open smb://nas/production
```

**Renomear a máquina no admin console:** Machines > [NAS] > ... > Edit machine name → `nas`

### 18f. Monitoramento da Conexão Tailscale

**Verificações semanais (incluir no healthcheck):**

1. Admin Console > Machines: NAS deve mostrar "Connected" com last seen recente
2. Se NAS mostrar "Last seen: X days ago" → NAS está offline ou Tailscale caiu
3. Configurar Uptime Kuma para pingar o NAS via IP Tailscale (100.x.y.z) — se falhar, alerta

**Cenário: NAS online mas Tailscale offline:**
- O NAS está funcionando mas o daemon Tailscale travou ou foi desabilitado
- Solução remota (se IPMI acessível por outro caminho): reiniciar o app via TrueNAS UI
- Solução local: pedir ao irmão para reiniciar o NAS (Situação 1 do guia)

**Cenário: Tailscale inteiro fora do ar (raro):**
- Tailscale control plane pode ter outage (verificar [status.tailscale.com](https://status.tailscale.com))
- Conexões já estabelecidas podem continuar (peer-to-peer direto via DERP)
- Se ambos os lados (NAS + Mac) já tiveram handshake, a conexão persiste por algumas horas

---

## 19. Baseline de Performance

### 19a. Por que Gravar Baseline

Antes de ir para Bangkok, gravar métricas de performance do NAS em condições normais. Esse baseline serve como referência futura:
- Se o NAS ficar lento daqui a 3 meses, comparar com o baseline para identificar a causa
- Se um drive for substituído, verificar que o novo tem performance similar
- Se a rede ficar lenta, saber qual era a velocidade normal

### 19b. Script de Baseline

```bash
#!/bin/bash
# /usr/local/bin/nas-baseline.sh
# Rodar UMA VEZ antes de viajar. Salvar output.
# Não rodar durante edição de vídeo ou backup ativo.

OUTPUT="/mnt/data/documents/nas-baseline-$(date +%Y%m%d).txt"

{
echo "╔════════════════════════════════════════════════════╗"
echo "║   NAS Performance Baseline — $(date)   ║"
echo "╚════════════════════════════════════════════════════╝"

echo ""
echo "━━━ Sistema ━━━"
uname -a
uptime
free -h

echo ""
echo "━━━ Pool Status ━━━"
zpool status data
zpool list data

echo ""
echo "━━━ Dataset Usage ━━━"
zfs list -o name,used,avail,refer,compressratio,recordsize -r data

echo ""
echo "━━━ SMART — Drive 0 ━━━"
smartctl -a /dev/nvme0n1 2>/dev/null || echo "Drive 0 não acessível"

echo ""
echo "━━━ SMART — Drive 1 ━━━"
smartctl -a /dev/nvme1n1 2>/dev/null || echo "Drive 1 não acessível"

echo ""
echo "━━━ SMART — Boot Drive ━━━"
smartctl -a /dev/nvme2n1 2>/dev/null || echo "Boot drive: verificar device path"

echo ""
echo "━━━ ARC Stats (ZFS Cache) ━━━"
cat /proc/spl/kstat/zfs/arcstats | grep -E "^(size|hits|misses|c_max|c_min)"

echo ""
echo "━━━ Sequential Write — 4GB (1M blocks) ━━━"
echo "Escrevendo arquivo de teste..."
dd if=/dev/zero of=/mnt/data/scratch/baseline-test-write bs=1M count=4096 oflag=direct 2>&1
sync

echo ""
echo "━━━ Sequential Read — 4GB (1M blocks) ━━━"
echo "Limpando cache de leitura..."
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null
echo "Lendo arquivo de teste..."
dd if=/mnt/data/scratch/baseline-test-write of=/dev/null bs=1M count=4096 iflag=direct 2>&1

echo ""
echo "━━━ Limpando arquivo de teste ━━━"
rm -f /mnt/data/scratch/baseline-test-write

echo ""
echo "━━━ Pool IOPS — amostra de 10 segundos ━━━"
zpool iostat data 1 10

echo ""
echo "━━━ UPS Status ━━━"
upsc ups@localhost 2>/dev/null || echo "UPS não configurado via NUT"

echo ""
echo "━━━ Tailscale Status ━━━"
tailscale status 2>/dev/null || echo "Tailscale não acessível"

echo ""
echo "━━━ Temperaturas ━━━"
sensors 2>/dev/null || echo "lm-sensors não instalado"
for dev in /dev/nvme?n1; do
  echo "--- ${dev} ---"
  smartctl -a "$dev" 2>/dev/null | grep -i "temperature"
done

echo ""
echo "━━━ Rede — Interfaces ━━━"
ip addr show | grep -E "^[0-9]|inet "

echo ""
echo "════════════════════════════════════════════════════"
echo "  TESTES MANUAIS (rodar separadamente):"
echo "════════════════════════════════════════════════════"
echo ""
echo "1. SMB Throughput (LAN):"
echo "   Copiar arquivo de 10GB via Finder/SMB, medir tempo."
echo "   Esperado single NIC: ~110 MB/s"
echo "   Esperado multichannel (2× i210): ~200-220 MB/s"
echo ""
echo "2. SMB Throughput (Tailscale WAN):"
echo "   Copiar arquivo de 1GB via SMB pelo Tailscale (4G do celular)."
echo "   Esperado: 5-20 MB/s (depende do ISP e distância)"
echo ""
echo "3. Tailscale Latência:"
echo "   Do Mac (via 4G): tailscale ping [IP-Tailscale-NAS]"
echo "   Esperado LAN: <5ms | WAN Brasil: 10-50ms | WAN Bangkok: 100-300ms"
echo ""
echo "4. iperf3 (LAN):"
echo "   Mac: iperf3 -s"
echo "   NAS: iperf3 -c 192.168.18.X -t 10"
echo "   Esperado: ~940 Mbps (single i210 GbE)"
echo ""

} 2>&1 | tee "$OUTPUT"

echo ""
echo "Baseline salvo em: $OUTPUT"
echo "COPIAR PARA OFFSITE: enviar por email ou salvar no B2."
```

### 19c. Valores de Referência Esperados

| Métrica | Valor esperado | Nota |
|---------|---------------|------|
| Sequential write (NVMe, dd) | 1.5-2.5 GB/s | Direct I/O, sem cache |
| Sequential read (NVMe, dd) | 2.0-3.0 GB/s | Direct I/O, sem cache |
| SMB throughput (single GbE) | 110-115 MB/s | Limite do i210 1GbE |
| SMB throughput (multichannel 2× GbE) | 200-220 MB/s | Depende do switch e cliente |
| SMB throughput (Tailscale WAN) | 5-20 MB/s | Depende do ISP em ambas as pontas |
| Tailscale latência (SP→Bangkok) | 200-350 ms | Via relay DERP ou direto |
| ARC hit rate | >85% | Depende do workload |
| Temperatura NVMe (idle) | 35-45°C | Sem airflow direto |
| Temperatura NVMe (sob carga) | 55-70°C | Thermal throttling a 80°C |
| UPS runtime (80W de carga) | 30-40 min | 600VA com bateria nova |
| Scrub duration (4TB mirror) | 2-6 horas | Depende da ocupação do pool |
| Resilver duration (4TB NVMe) | 1-2 horas | NVMe é rápido no resilver |

### 19d. Onde Salvar o Baseline

| Local | Caminho / Destino | Por quê |
|-------|------------------|---------|
| NAS | `/mnt/data/documents/nas-baseline-YYYYMMDD.txt` | Referência rápida |
| Email | Draft no Gmail (anexo) | Acessível de qualquer lugar |
| B2 | `b2:nas-backup-thiago/config/nas-baseline-YYYYMMDD.txt` | Sobrevive à perda total |
| Gerenciador de senhas | Nota segura com link para o arquivo | Referência em emergência |

> **Repetir o baseline após mudanças significativas:** mirror conversion, troca de drive,
> upgrade de firmware, mudança de rede. Comparar com o original para detectar regressões.

---

## Regra de Ouro

> **Insubstituível** — footage original, fotos pessoais, documentos
> Backup local + offsite + snapshots frequentes. Tratar como se não existisse segunda chance.
>
> **Difícil de recriar** — b-roll, áudio curado, graphics, projetos de edição
> Backup local + snapshots moderados. Recriar é possível mas custa dias de trabalho.
>
> **Regenerável** — cache do Resolve, proxies, exports renderizados
> Sem backup. Snapshots mínimos ou nenhum. Priorizar performance.
>
> **Descartável** — entretenimento, containers, dados transitórios
> Sem backup. Snapshots de cortesia. Perda aceitável.
>
> **Acesso remoto** — Tailscale, IPMI, configuração TrueNAS
> Sem acesso remoto, o NAS é um tijolo caro na casa do irmão.
> Proteger credenciais, keys e configurações como dados insubstituíveis.

Cada decisão sobre backup, snapshots e retenção neste documento segue essa hierarquia. Na dúvida, classificar o dado uma categoria acima.