#!/usr/bin/env python3
"""Medidor de aceite do custo do Claude Code (stdlib). Rodar sempre com `python3 -I`.

  custo-aceite.py janela --desde 2026-10-09T00:00 --ate 2026-10-14T11:00 [--json saida.json]
  custo-aceite.py diario
  custo-aceite.py relatorio --base base.json --desde 2026-10-14T11:00 [--ate AGORA]
  custo-aceite.py qualidade --desde 2026-10-07T00:00 --ate 2026-10-14T12:00 [--limites 300000,400000,500000,1000000]

Horas sem fuso = America/Sao_Paulo. Preço de lista (estimativa). So agregados saem; log bruto nunca.
Despacho "em Opus": model explicito contendo opus, ou model ausente herdando sessao que estava em Opus.
"""
import argparse, csv, glob, json, os, re, statistics as st, sys, time
from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")
CUSTO_DIR = os.path.expanduser("~/Workspace/handoff/custo")
RAIZ = os.path.expanduser("~/.claude/projects")

PRECOS = {  # input, output, leitura, escrita 5m, escrita 1h (US$/Mtok)
    "fable": (10.0, 50.0, 0.50, 12.5, 20.0),
    "opus": (4.0, 20.0, 0.20, 5.0, 8.0),
    "sonnet": (2.0, 10.0, 0.10, 2.5, 4.0),
    "haiku": (0.10, 0.50, 0.01, 0.125, 0.20),
}
HAIKU_DEGRAU = 100_000


def familia(modelo):
    m = (modelo or "").lower()
    for f in PRECOS:
        if f in m:
            return f
    return None


def custo(fam, u):
    p = PRECOS[fam]
    cc = u.get("cache_creation") or {}
    w1h = cc.get("ephemeral_1h_input_tokens", 0) or 0
    w5m = cc.get("ephemeral_5m_input_tokens", 0) or 0
    if not (w1h or w5m):
        w5m = u.get("cache_creation_input_tokens", 0) or 0
    inp = u.get("input_tokens", 0) or 0
    out = u.get("output_tokens", 0) or 0
    lido = u.get("cache_read_input_tokens", 0) or 0
    mult = 5 if fam == "haiku" and inp + lido + w1h + w5m > HAIKU_DEGRAU else 1
    k = mult / 1e6
    return {"input": inp * p[0] * k, "output": out * p[1] * k, "leitura": lido * p[2] * k,
            "escrita": (w5m * p[3] + w1h * p[4]) * k}, w1h + w5m, lido, inp


def epoch(ts):
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


def parse_local(s):
    d = datetime.fromisoformat(s)
    if d.tzinfo is None:
        d = d.replace(tzinfo=TZ)
    return d.timestamp()


def mediana(l):
    return st.median(l) if l else None


def medir(desde, ate):
    arquivos = [a for a in glob.glob(RAIZ + "/**/*.jsonl", recursive=True) if os.path.getmtime(a) >= desde]
    vistos, compact = set(), set()
    tot = defaultdict(float)
    dia = defaultdict(float)
    passos = {"principal": 0, "subagente": 0}
    cust = {"principal": 0.0, "subagente": 0.0}
    sub_modelo = defaultdict(float)
    principal_acima_300k = 0.0
    causas = defaultdict(lambda: [0, 0.0])
    despachos = {}  # id -> (subagent_type, model_eff, effort)
    primeiro = []  # (tipo, ctx)
    for arq in arquivos:
        sub = "/subagents/" in arq
        atype = "?"
        if sub:
            try:
                atype = json.load(open(arq[:-6] + ".meta.json")).get("agentType", "?")
            except Exception:
                pass
        msgs = {}
        try:
            with open(arq, encoding="utf-8", errors="replace") as f:
                for linha in f:
                    achou_agent = '"Agent"' in linha and '"tool_use"' in linha
                    if '"usage"' not in linha and not achou_agent and "compact_boundary" not in linha:
                        continue
                    try:
                        d = json.loads(linha)
                    except Exception:
                        continue
                    t = epoch(d.get("timestamp", ""))
                    if d.get("type") == "system" and d.get("subtype") == "compact_boundary":
                        if t and desde <= t < ate and d.get("uuid"):
                            compact.add(d["uuid"])
                        continue
                    m = d.get("message") or {}
                    if d.get("type") != "assistant" or not isinstance(m, dict):
                        continue
                    if achou_agent and t and desde <= t < ate:
                        for b in m.get("content") or []:
                            if isinstance(b, dict) and b.get("type") == "tool_use" and b.get("name") == "Agent":
                                i = b.get("input") or {}
                                mod = (i.get("model") or "").lower()
                                if not mod:
                                    mod = "(herdado) " + ("opus" if "opus" in (m.get("model") or "").lower() else "outro")
                                despachos[b.get("id")] = (i.get("subagent_type") or "general-purpose", mod, (i.get("effort") or "").lower())
                    if m.get("id") and m.get("usage"):
                        msgs[m["id"]] = (t, m.get("model"), m["usage"], bool(d.get("isSidechain")) or sub)
        except OSError:
            continue
        ant_t = ant_modelo = None
        primeiro_visto = False
        for mid, (t, modelo, u, lateral) in sorted(msgs.items(), key=lambda x: x[1][0] or 0):
            if t is None or t < desde or t >= ate or mid in vistos:
                continue
            vistos.add(mid)
            fam = familia(modelo)
            if not fam:
                continue
            c, escrito, lido, inp = custo(fam, u)
            total = sum(c.values())
            tipo = "subagente" if lateral else "principal"
            ctx = escrito + lido + inp
            passos[tipo] += 1
            cust[tipo] += total
            for k, v in c.items():
                tot[k] += v
            dia[datetime.fromtimestamp(t, TZ).strftime("%Y-%m-%d")] += total
            if lateral:
                sub_modelo[fam] += total
                if sub and not primeiro_visto:
                    primeiro.append((atype, ctx))
                    primeiro_visto = True
            elif ctx > 300_000:
                principal_acima_300k += total
            if escrito > 30_000 and escrito > lido:
                ttl = 300 if (lateral and not (u.get("cache_creation") or {}).get("ephemeral_1h_input_tokens")) else 3600
                if ant_t is None:
                    causa = "início de sessão/agente"
                elif familia(ant_modelo) != fam:
                    causa = "troca de modelo"
                elif t - ant_t > ttl:
                    causa = "subagente esperou > 5 min" if ttl == 300 else "pausa > 1 h"
                else:
                    causa = "outro (compactação, retomada, /fast)"
                causas[causa][0] += 1
                causas[causa][1] += c["escrita"]
            ant_t, ant_modelo = t, modelo

    total = sum(tot.values())
    nd = len(despachos)
    por_tipo = defaultdict(int)
    sem_model = high = gp_opus = 0
    for stype, mod, eff in despachos.values():
        por_tipo[stype] += 1
        if mod.startswith("(herdado)"):
            sem_model += 1
        if eff == "high":
            high += 1
        if stype in ("general-purpose", "workflow") and "opus" in mod:
            gp_opus += 1
    pct = lambda a, b: (100.0 * a / b) if b else None
    prim_por_tipo = defaultdict(list)
    for tp, c in primeiro:
        prim_por_tipo[tp].append(c)
    sub_total = cust["subagente"]
    return {
        "desde": datetime.fromtimestamp(desde, TZ).isoformat(timespec="minutes"),
        "ate": datetime.fromtimestamp(ate, TZ).isoformat(timespec="minutes"),
        "dias": (ate - desde) / 86400,
        "arquivos": len(arquivos),
        "usd_total": total,
        "usd_por_dia_media": total / max((ate - desde) / 86400, 1e-9),
        "usd_por_dia": dict(sorted(dia.items())),
        "passos_principal": passos["principal"],
        "passos_subagente": passos["subagente"],
        "usd_principal": cust["principal"],
        "usd_subagente": sub_total,
        "usd_por_passo_subagente": sub_total / passos["subagente"] if passos["subagente"] else None,
        "pct_opus_no_custo_subagente": pct(sub_modelo["opus"], sub_total),
        "despachos_total": nd,
        "despachos_pct_sem_model": pct(sem_model, nd),
        "despachos_pct_gp_workflow_opus": pct(gp_opus, nd),
        "despachos_pct_effort_high": pct(high, nd),
        "despachos_por_tipo": dict(sorted(por_tipo.items(), key=lambda x: -x[1])),
        "mediana_ctx_1o_passo": mediana([c for _, c in primeiro]),
        "n_1o_passo": len(primeiro),
        "mediana_ctx_1o_passo_por_tipo": {k: mediana(v) for k, v in prim_por_tipo.items()},
        "n_1o_passo_por_tipo": {k: len(v) for k, v in prim_por_tipo.items()},
        "pct_custo_principal_ctx_acima_300k": pct(principal_acima_300k, cust["principal"]),
        "reescritas_cache": {k: {"n": v[0], "usd": v[1]} for k, v in causas.items()},
        "compactacoes": len(compact),
        "usd_escrita": tot["escrita"], "usd_leitura": tot["leitura"],
        "usd_output": tot["output"], "usd_input": tot["input"],
    }


def f(v, nd=1, suf=""):
    return "n/d" if v is None else f"{v:,.{nd}f}{suf}"


def imprimir(r):
    out = [f"Janela {r['desde']} -> {r['ate']} ({r['dias']:.2f} dias) · {r['arquivos']} arquivos · preço de lista",
           f"US$ total {f(r['usd_total'],2)} · média/dia {f(r['usd_por_dia_media'],2)} · principal {f(r['usd_principal'],2)} · subagente {f(r['usd_subagente'],2)}",
           "Por dia: " + " · ".join(f"{k} {v:,.0f}" for k, v in r["usd_por_dia"].items()),
           f"Passos: principal {r['passos_principal']} · subagente {r['passos_subagente']} · US$/passo subagente {f(r['usd_por_passo_subagente'],4)}",
           f"Opus no custo de subagente {f(r['pct_opus_no_custo_subagente'],1,'%')}",
           f"Despachos {r['despachos_total']} · sem model {f(r['despachos_pct_sem_model'],1,'%')} · gp/workflow em Opus {f(r['despachos_pct_gp_workflow_opus'],1,'%')} · effort high {f(r['despachos_pct_effort_high'],1,'%')}",
           "Por tipo: " + " · ".join(f"{k} {v}" for k, v in r["despachos_por_tipo"].items()),
           f"Mediana ctx 1º passo {f(r['mediana_ctx_1o_passo'],0)} (n={r['n_1o_passo']}) · por tipo: " + " · ".join(f"{k} {f(v,0)} (n={r['n_1o_passo_por_tipo'][k]})" for k, v in r["mediana_ctx_1o_passo_por_tipo"].items()),
           f"Custo da sessão principal com ctx > 300K: {f(r['pct_custo_principal_ctx_acima_300k'],1,'%')}",
           "Reescritas de cache: " + " · ".join(f"{k} {v['n']}× US$ {v['usd']:,.2f}" for k, v in sorted(r["reescritas_cache"].items(), key=lambda x: -x[1]['usd'])) + f" · compactações {r['compactacoes']}",
           f"Itens: escrita {f(r['usd_escrita'],2)} · leitura {f(r['usd_leitura'],2)} · output {f(r['usd_output'],2)} · input {f(r['usd_input'],2)}"]
    print("\n".join(out))


METAS = [  # chave, rotulo, limite (<=)
    ("usd_por_passo_subagente", "US$/passo de subagente", 0.034),
    ("despachos_pct_gp_workflow_opus", "gp/workflow em Opus (% despachos)", 5.0),
    ("pct_opus_no_custo_subagente", "Opus no custo de subagente (%)", 50.0),
    ("despachos_pct_effort_high", "effort high (% despachos)", 20.0),
    ("mediana_ctx_1o_passo", "Mediana ctx 1º passo", 47000.0),
]


def cmd_diario(_):
    agora = time.time()
    r = medir(agora - 86400, agora)
    dia = datetime.fromtimestamp(agora, TZ).strftime("%Y-%m-%d")
    os.makedirs(CUSTO_DIR, exist_ok=True)
    arq = os.path.join(CUSTO_DIR, "diario.csv")
    cab = ["dia", "usd_total", "usd_principal", "usd_subagente", "passos_principal", "passos_subagente",
           "usd_por_passo_subagente", "pct_opus_custo_sub", "despachos", "pct_gp_wf_opus", "pct_high",
           "mediana_ctx_1o_passo", "pct_principal_ctx_300k", "compactacoes"]
    existe = os.path.exists(arq)
    if existe and any(l.split(",")[0] == dia for l in open(arq).read().splitlines()[1:]):
        print(f"{dia} já está em {arq}; nada a acrescentar")
        return
    lin = [dia, f"{r['usd_total']:.2f}", f"{r['usd_principal']:.2f}", f"{r['usd_subagente']:.2f}", r["passos_principal"],
           r["passos_subagente"], *(("" if r[k] is None else f"{r[k]:.4f}") for k in ("usd_por_passo_subagente",)),
           *(("" if r[k] is None else f"{r[k]:.1f}") for k in ("pct_opus_no_custo_subagente",)),
           r["despachos_total"],
           *(("" if r[k] is None else f"{r[k]:.1f}") for k in ("despachos_pct_gp_workflow_opus", "despachos_pct_effort_high")),
           "" if r["mediana_ctx_1o_passo"] is None else f"{r['mediana_ctx_1o_passo']:.0f}",
           "" if r["pct_custo_principal_ctx_acima_300k"] is None else f"{r['pct_custo_principal_ctx_acima_300k']:.1f}",
           r["compactacoes"]]
    with open(arq, "a", newline="") as fh:
        w = csv.writer(fh)
        if not existe:
            w.writerow(cab)
        w.writerow(lin)
    print(f"Linha de {dia} acrescentada em {arq}")


def cmd_janela(a):
    r = medir(parse_local(a.desde), parse_local(a.ate))
    imprimir(r)
    if a.json:
        os.makedirs(os.path.dirname(os.path.abspath(a.json)), exist_ok=True)
        json.dump(r, open(a.json, "w"), indent=1, ensure_ascii=False)
        print(f"JSON: {a.json}")


def cmd_relatorio(a):
    base = json.load(open(a.base))
    ate = parse_local(a.ate) if a.ate else time.time()
    r = medir(parse_local(a.desde), ate)
    pb, pr = base["passos_subagente"] + base["passos_principal"], r["passos_subagente"] + r["passos_principal"]
    # volume por dia (janelas de tamanhos diferentes)
    vb, vr = pb / base["dias"], pr / max(r["dias"], 1e-9)
    comparavel = abs(vr - vb) <= 0.15 * vb if vb else False
    L = [f"# Avaliação do custo do Claude Code ({datetime.fromtimestamp(ate, TZ):%Y-%m-%d})", "",
         f"Base: {base['desde']} -> {base['ate']} ({base['dias']:.2f} d). Depois: {r['desde']} -> {r['ate']} ({r['dias']:.2f} d). Preço de lista, estimativa.", "",
         "## Metas", "", "| Métrica | Base | Depois | Meta | Resultado |", "|---|---|---|---|---|"]
    for k, rot, lim in METAS:
        b, d = base.get(k), r.get(k)
        dec = 4 if k == "usd_por_passo_subagente" else (0 if lim > 1000 else 1)
        res = "n/d" if d is None else ("passou" if d <= lim else "FALHOU")
        L.append(f"| {rot} | {f(b,dec)} | {f(d,dec)} | ≤ {lim:g} | {res} |")
    L += ["", "## Volume e total", "",
          f"Passos/dia: base {vb:,.0f} · depois {vr:,.0f} ({(vr/vb-1)*100 if vb else 0:+.0f}%). " +
          ("Dentro de ±15%: total por dia comparável." if comparavel else "Fora de ±15%: o total por dia é NÃO COMPARÁVEL; vale só o por passo."), "",
          "| | Base | Depois |", "|---|---|---|",
          f"| US$ total | {f(base['usd_total'],0)} | {f(r['usd_total'],0)} |",
          f"| US$/dia | {f(base['usd_por_dia_media'],0)}{'' if comparavel else ' (não comparável)'} | {f(r['usd_por_dia_media'],0)}{'' if comparavel else ' (não comparável)'} |",
          f"| Passos subagente | {base['passos_subagente']} | {r['passos_subagente']} |",
          f"| Passos principal | {base['passos_principal']} | {r['passos_principal']} |",
          f"| Despachos | {base['despachos_total']} | {r['despachos_total']} |",
          f"| Despachos sem model (%) | {f(base['despachos_pct_sem_model'])} | {f(r['despachos_pct_sem_model'])} |",
          f"| Ctx 1º passo, mediana por tipo | {base['mediana_ctx_1o_passo_por_tipo']} | {r['mediana_ctx_1o_passo_por_tipo']} |",
          f"| Custo principal com ctx > 300K (%) | {f(base['pct_custo_principal_ctx_acima_300k'])} | {f(r['pct_custo_principal_ctx_acima_300k'])} |",
          f"| Compactações | {base['compactacoes']} | {r['compactacoes']} |",
          f"| Escrita / leitura / output (US$) | {base['usd_escrita']:,.0f} / {base['usd_leitura']:,.0f} / {base['usd_output']:,.0f} | {r['usd_escrita']:,.0f} / {r['usd_leitura']:,.0f} / {r['usd_output']:,.0f} |",
          "", "Despachos por tipo: base " + str(base["despachos_por_tipo"]) + " · depois " + str(r["despachos_por_tipo"]),
          "", "Reescritas de cache (n, US$): base " + str({k: (v['n'], round(v['usd'])) for k, v in base['reescritas_cache'].items()}) +
          " · depois " + str({k: (v['n'], round(v['usd'])) for k, v in r['reescritas_cache'].items()}),
          "", "Qualidade (achado perdido em Sonnet, estado perdido por compactação) não é medida aqui: conferir à mão (README, aceite)."]
    os.makedirs(CUSTO_DIR, exist_ok=True)
    arq = os.path.join(CUSTO_DIR, f"{datetime.fromtimestamp(ate, TZ):%Y-%m-%d}-avaliacao.md")
    try:
        L += ["", qualidade_secao(parse_local(a.desde), ate, [int(x) for x in LIMITES_PADRAO.split(",")])]
    except Exception as ex:  # a seção nova nunca derruba o relatório
        L += ["", f"Seção de qualidade falhou: {type(ex).__name__}"]
    open(arq, "w").write("\n".join(L) + "\n")
    print(arq)


# ---------------------------------------------------------------- qualidade da compactação
LIMITES_PADRAO = "300000,400000,500000,1000000"
LIMITE_ATUAL = 300_000
JANELA_POS = 20
RE_CORRECAO = re.compile(r"já (te )?(falei|disse|decidimos|combinamos)|de novo|esqueceu|não era isso|perdeu o fio|#perdeu-o-fio", re.I)
RE_FIO = re.compile(r"#perdeu-o-fio", re.I)
PADRAO_POS = 90_000
CHARS_POR_TOKEN = 3.5  # estimativa: o chamado do resumo não grava usage no log


def _texto_usuario(m):
    """Texto digitado (str ou blocos text, sem tool_result); None se não for digitado."""
    c = m.get("content") if isinstance(m, dict) else None
    if isinstance(c, str):
        t = c
    elif isinstance(c, list):
        if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in c):
            return None
        t = "\n".join(b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text")
    else:
        return None
    t = t.strip()
    if not t or t.startswith("<") or t.startswith("[Request interrupted") or t.startswith("Caveat:"):
        return None
    return t


def ler_sessao(arq, desde, ate):
    """Eventos ordenados de uma sessão principal. Só agregados/flags saem; texto nunca é guardado."""
    ev, idx = [], {}
    nsteps = 0
    lidos_ids = set()
    try:
        with open(arq, encoding="utf-8", errors="replace") as fh:
            for linha in fh:
                if not ('"type":"assistant"' in linha or '"type":"user"' in linha or "compact_boundary" in linha
                        or '"type": "assistant"' in linha or '"type": "user"' in linha):
                    continue
                try:
                    d = json.loads(linha)
                except Exception:
                    continue
                t = epoch(d.get("timestamp", ""))
                tp = d.get("type")
                if d.get("isSidechain"):
                    continue
                if tp == "system" and d.get("subtype") == "compact_boundary":
                    cm = d.get("compactMetadata") or {}
                    ev.append({"k": "compact", "t": t, "post": cm.get("postTokens"), "pre": cm.get("preTokens"), "resumo": None})
                    continue
                m = d.get("message")
                if not isinstance(m, dict):
                    continue
                if tp == "user":
                    if d.get("isCompactSummary"):
                        c = m.get("content")
                        n = len(c) if isinstance(c, str) else sum(len(b.get("text", "")) for b in c or [] if isinstance(b, dict))
                        for e in reversed(ev):
                            if e["k"] == "compact":
                                e["resumo"] = n / CHARS_POR_TOKEN
                                break
                        continue
                    if d.get("isMeta"):
                        continue
                    tx = _texto_usuario(m)
                    if tx is not None:
                        ev.append({"k": "user", "t": t, "corr": bool(RE_CORRECAO.search(tx)), "fio": bool(RE_FIO.search(tx))})
                    continue
                if tp != "assistant" or not m.get("id"):
                    continue
                mid = m["id"]
                if mid not in idx:
                    nsteps += 1
                    e = {"k": "step", "t": t, "n": nsteps, "modelo": m.get("model"), "u": None, "ask": False, "q": False}
                    idx[mid] = e
                    ev.append(e)
                e = idx[mid]
                if m.get("usage"):
                    e["u"] = m["usage"]
                for b in m.get("content") or []:
                    if not isinstance(b, dict):
                        continue
                    if b.get("type") == "text":
                        e["q"] = b.get("text", "").rstrip().endswith("?")
                    elif b.get("type") == "tool_use":
                        if b.get("id") in lidos_ids:
                            continue
                        lidos_ids.add(b.get("id"))
                        if b.get("name") == "AskUserQuestion":
                            e["ask"] = True
                        elif b.get("name") == "Read":
                            p = (b.get("input") or {}).get("file_path")
                            if p:
                                ev.append({"k": "read", "t": t, "path": p, "n": nsteps})
    except OSError:
        pass
    return ev


def coletar_qualidade(desde, ate):
    arquivos = [a for a in glob.glob(RAIZ + "/**/*.jsonl", recursive=True)
                if "/subagents/" not in a and os.path.getmtime(a) >= desde]
    pos = {"comp": 0, "passos": 0, "reads": 0, "relidos": 0, "users": 0, "corr": 0, "turnos": 0, "perg": 0}
    ctl = {"comp": 0, "passos": 0, "reads": 0, "relidos": 0, "users": 0, "corr": 0, "turnos": 0, "perg": 0}
    fios = []
    posts, resumos = [], []
    sessoes = []  # para simulação: lista de passos
    for arq in arquivos:
        ev = ler_sessao(arq, desde, ate)
        sid = os.path.basename(arq)[:8]
        comp_n = [e["n"] for e in [None] if False]
        # nº de passos já vistos no momento de cada compactação
        passos_antes, cont, compactacoes = 0, 0, []
        for e in ev:
            if e["k"] == "step":
                cont += 1
            elif e["k"] == "compact":
                e["s0"] = cont
                compactacoes.append(e)
        steps = [e for e in ev if e["k"] == "step" and e["u"]]
        dentro = lambda t: t is not None and desde <= t < ate

        def rotulo(n):
            r = "ctl"
            for c in compactacoes:
                dist = n - c["s0"]
                if 0 < dist <= JANELA_POS:
                    return "pos"
                if -JANELA_POS < dist <= 0:
                    r = None
            return r
        # compactações na janela e contexto pós
        for c in compactacoes:
            if not dentro(c["t"]):
                continue
            pos["comp"] += 1
            ctl_ok = True
            if c["resumo"]:
                resumos.append(c["resumo"])
            nxt = next((e for e in steps if e["n"] > c["s0"]), None)
            if c["post"]:
                posts.append(c["post"])
            elif nxt:
                f_ = familia(nxt["modelo"])
                if f_:
                    _, w, l, i = custo(f_, nxt["u"])
                    posts.append(w + l + i)
        if not compactacoes:
            pass  # controle = só sessões que têm compactação (mesmas sessões)
        else:
            lidos_seg, lidos_antes = set(), set()
            ult_comp = 0
            prox = 0
            cacomp = sorted(compactacoes, key=lambda c: c["s0"])
            # varre eventos mantendo conjuntos
            ci = 0
            turno_ult = None  # (rotulo, pergunta)
            def fecha(tu):
                if tu is None or not dentro(tu[2]):
                    return
                alvo = pos if tu[0] == "pos" else (ctl if tu[0] == "ctl" else None)
                if alvo is None:
                    return
                alvo["turnos"] += 1
                alvo["perg"] += 1 if tu[1] else 0
            prev_user_pending = None
            for e in ev:
                if e["k"] == "compact":
                    lidos_antes = set(lidos_antes) | lidos_seg
                    lidos_seg = set()
                elif e["k"] == "read":
                    r = rotulo(e["n"])
                    if dentro(e["t"]) and r:
                        alvo = pos if r == "pos" else ctl
                        alvo["reads"] += 1
                        ja = (e["path"] in lidos_antes) if r == "pos" else (e["path"] in lidos_seg)
                        alvo["relidos"] += 1 if ja else 0
                    lidos_seg.add(e["path"])
                elif e["k"] == "user":
                    if prev_user_pending is not None:
                        pass
                    fecha(turno_ult)
                    turno_ult = None
                    prev_user_pending = e
                    if e["fio"] and dentro(e["t"]):
                        fios.append((datetime.fromtimestamp(e["t"], TZ).strftime("%Y-%m-%d"), sid))
                elif e["k"] == "step":
                    r = rotulo(e["n"])
                    if dentro(e["t"]):
                        if r in ("pos", "ctl"):
                            (pos if r == "pos" else ctl)["passos"] += 1
                    if prev_user_pending is not None:
                        pu = prev_user_pending
                        prev_user_pending = None
                        if dentro(pu["t"]) and r in ("pos", "ctl"):
                            alvo = pos if r == "pos" else ctl
                            alvo["users"] += 1
                            alvo["corr"] += 1 if pu["corr"] else 0
                    turno_ult = (r, e["q"] or e["ask"], e["t"])
            fecha(turno_ult)
        # #perdeu-o-fio em sessões sem compactação também contam
        if not compactacoes:
            for e in ev:
                if e["k"] == "user" and e["fio"] and dentro(e["t"]):
                    fios.append((datetime.fromtimestamp(e["t"], TZ).strftime("%Y-%m-%d"), sid))
        # passos para simulação (todas as sessões principais na janela)
        sp, brk = [], False
        prev_ctx = None
        for e in ev:
            if e["k"] == "compact":
                brk = True
            elif e["k"] == "step" and e["u"] and dentro(e["t"]):
                fam = familia(e["modelo"])
                if not fam:
                    continue
                c, w, l, i = custo(fam, e["u"])
                ctx = w + l + i
                reset = prev_ctx is None or (not brk and ctx < 0.4 * prev_ctx)
                sp.append({"fam": fam, "ctx": ctx, "out": c["output"] + c["input"], "brk": brk, "reset": reset})
                brk = False
                prev_ctx = ctx
        if sp:
            sessoes.append(sp)
    return {"pos": pos, "ctl": ctl, "fios": sorted(fios), "posts": posts, "resumos": resumos,
            "sessoes": sessoes, "n_sessoes": len(arquivos)}


def simular(sessoes, limite, med_pos, resumo_tok):
    total = 0.0
    ncomp = 0
    for sp in sessoes:
        s = 0.0
        prev = None
        for p in sp:
            pr = PRECOS[p["fam"]]
            if p["reset"]:
                s, g = 0.0, p["ctx"]
            elif p["brk"]:
                g = 0.0
            else:
                g = max(p["ctx"] - prev, 0.0)
            prev = p["ctx"]
            if s + g > limite:
                total += (resumo_tok * pr[1] + med_pos * pr[4]) / 1e6
                ncomp += 1
                s = med_pos
            total += (p["out"] if False else 0)
            total += p["out"] + (s * pr[2] + g * pr[4]) / 1e6
            s += g
    return total, ncomp


def _taxa(a, b):
    return (a / b) if b else None


def _razao(x, y):
    if x is None or y is None:
        return None, "n/d"
    if y == 0:
        return (float("inf") if x > 0 else 0.0), ("∞" if x > 0 else "0")
    return x / y, f"{x / y:.1f}x"


def qualidade_secao(desde, ate, limites):
    dados = coletar_qualidade(desde, ate)
    pos, ctl = dados["pos"], dados["ctl"]
    dias = max((ate - desde) / 86400, 1e-9)
    med_pos = mediana(dados["posts"])
    pos_nota = "observada" if med_pos else f"sem dado: padrão {PADRAO_POS:,}"
    med_pos = med_pos or PADRAO_POS
    resumo_tok = (sum(dados["resumos"]) / len(dados["resumos"])) if dados["resumos"] else 8000
    resumo_nota = f"média de {len(dados['resumos'])} resumos observados (tamanho do texto / {CHARS_POR_TOKEN} chars por token, estimativa)" if dados["resumos"] else "sem dado: padrão 8.000 tokens"
    linhas = [f"## Qualidade da compactação ({datetime.fromtimestamp(desde, TZ):%Y-%m-%d %H:%M} -> {datetime.fromtimestamp(ate, TZ):%Y-%m-%d %H:%M}, só sessão principal)", "",
              f"Compactações detectadas: {pos['comp']} (marcador `compact_boundary` do log). Janela pós: os {JANELA_POS} passos seguintes. "
              f"Controle: passos da mesma janela, nas mesmas sessões que compactaram, a mais de {JANELA_POS} passos de qualquer compactação.", "",
              "| Taxa | Pós-compactação | N (pós) | Controle | N (controle) | Razão |", "|---|---|---|---|---|---|"]
    defs = [("Releitura (% dos Reads)", "relidos", "reads", 100.0, "Reads"),
            ("Correção do dono (% das mensagens)", "corr", "users", 100.0, "mensagens"),
            ("Pergunta ao dono (% dos turnos)", "perg", "turnos", 100.0, "turnos")]
    razoes = {}
    for rot, a, b, k, un in defs:
        x, y = _taxa(pos[a], pos[b]), _taxa(ctl[a], ctl[b])
        r, rs = _razao(x, y)
        razoes[a] = r
        fx = "n/d" if x is None else f"{x*k:.1f}% ({pos[a]}/{pos[b]})"
        fy = "n/d" if y is None else f"{y*k:.1f}% ({ctl[a]}/{ctl[b]})"
        linhas.append(f"| {rot} | {fx} | {pos[b]} {un} | {fy} | {ctl[b]} {un} | {rs} |")
    linhas += ["", "Releitura pós = Read de caminho lido na sessão antes da compactação; no controle = Read de caminho já lido no mesmo trecho de contexto (desde o início ou a última compactação).", ""]
    fios = dados["fios"]
    if fios:
        linhas.append(f"**ATENÇÃO: {len(fios)} ocorrência(s) de `#perdeu-o-fio`:** " + "; ".join(f"{d} sessão {s}" for d, s in fios))
    else:
        linhas.append("`#perdeu-o-fio`: 0 ocorrências na janela.")
    # simulação
    linhas += ["", "## Simulação do limite de compactação", ""]
    res = {}
    for L in limites:
        res[L] = simular(dados["sessoes"], L, med_pos, resumo_tok)
    base = res.get(LIMITE_ATUAL) or simular(dados["sessoes"], LIMITE_ATUAL, med_pos, resumo_tok)
    linhas += ["| Limite | US$ principal (simulado) | US$/dia | Diferença vs 300K (US$/dia) | Compactações simuladas |", "|---|---|---|---|---|"]
    for L in limites:
        c, n = res[L]
        linhas.append(f"| {L:,} | {c:,.0f} | {c/dias:,.1f} | {(c-base[0])/dias:+,.1f} | {n} |")
    linhas += ["", "Premissas: curva de contexto por passo reconstruída dos logs (crescimento por passo observado; queda de compactação ou reset tratada como crescimento 0 ou nova sessão); "
               f"ao passar o limite o contexto cai para {med_pos:,.0f} tokens ({pos_nota}); cada compactação custa {resumo_tok:,.0f} tokens de resumo em output ({resumo_nota}) mais a escrita do contexto pós no preço de cache 1 h; "
               "cada passo paga leitura do contexto anterior, escrita do crescimento, output e input observados. Pausas > 1 h, TTL e reescritas por troca de modelo NÃO são simuladas; "
               "o limite atual (300K) é simulado pelo mesmo modelo, então a diferença é comparável mesmo se o nível absoluto não bate com o gasto real. Preço de lista, estimativa.", ""]
    # recomendação
    econ = None
    if 500_000 in res:
        econ = (res[500_000][0] - base[0]) / dias
    linhas.append("## Recomendação (regra automática)")
    linhas.append("")
    cor, rel = razoes.get("corr"), razoes.get("relidos")
    ruim_corr = cor is not None and cor >= 2
    ruim_rel = rel is not None and rel >= 2
    econ_s = "n/d (500K fora de --limites)" if econ is None else f"US$ {econ:,.1f}/dia"
    if pos["comp"] < 10:
        rec = f"dados insuficientes ({pos['comp']} compactações, mínimo 10); manter 300K mais 1 semana."
    elif (ruim_corr or ruim_rel) and econ is not None and econ < 5:
        rec = f"subir para 500K (correção {_razao(_taxa(pos['corr'],pos['users']),_taxa(ctl['corr'],ctl['users']))[1]}, releitura {_razao(_taxa(pos['relidos'],pos['reads']),_taxa(ctl['relidos'],ctl['reads']))[1]}; economia de 300K contra 500K: {econ_s})."
    elif ruim_corr and econ is not None and econ >= 5:
        rec = f"decidir com o dono: correção do dono em {_razao(_taxa(pos['corr'],pos['users']),_taxa(ctl['corr'],ctl['users']))[1]} o controle; economia de 300K contra 500K: {econ_s}."
    else:
        rec = f"manter 300K (economia de 300K contra 500K: {econ_s})."
    linhas.append(rec)
    if fios:
        linhas.append("")
        linhas.append(f"**DESTAQUE: {len(fios)} `#perdeu-o-fio` na janela (acima), qualquer que seja a regra.**")
    return "\n".join(linhas) + "\n"


def cmd_qualidade(a):
    lim = [int(x) for x in a.limites.split(",")]
    print(qualidade_secao(parse_local(a.desde), parse_local(a.ate), lim))


def main():
    p = argparse.ArgumentParser()
    s = p.add_subparsers(dest="cmd", required=True)
    j = s.add_parser("janela"); j.add_argument("--desde", required=True); j.add_argument("--ate", required=True); j.add_argument("--json")
    j.set_defaults(fn=cmd_janela)
    s.add_parser("diario").set_defaults(fn=cmd_diario)
    r = s.add_parser("relatorio"); r.add_argument("--base", required=True); r.add_argument("--desde", required=True); r.add_argument("--ate")
    r.set_defaults(fn=cmd_relatorio)
    q = s.add_parser("qualidade"); q.add_argument("--desde", required=True); q.add_argument("--ate", required=True); q.add_argument("--limites", default=LIMITES_PADRAO)
    q.set_defaults(fn=cmd_qualidade)
    a = p.parse_args()
    a.fn(a)


main()
