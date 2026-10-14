import glob, json, os, sys, time, statistics as st
from collections import defaultdict
from datetime import datetime
DIAS=int(sys.argv[1]) if len(sys.argv)>1 else 5
P={"opus":(4.0,20.0,0.20,5.0,8.0),"sonnet":(2.0,10.0,0.10,2.5,4.0),"haiku":(0.10,0.5,0.01,0.125,0.2),"fable":(10,50,0.5,12.5,20)}
def fam(m):
    m=(m or "").lower()
    for f in P:
        if f in m: return f
def ep(ts):
    try: return datetime.fromisoformat(ts.replace("Z","+00:00")).timestamp()
    except: return None
def cost(f,u,asf=None):
    p=P[asf or f]; cc=u.get("cache_creation") or {}
    w1=cc.get("ephemeral_1h_input_tokens",0) or 0; w5=cc.get("ephemeral_5m_input_tokens",0) or 0
    if not(w1 or w5): w5=u.get("cache_creation_input_tokens",0) or 0
    i=u.get("input_tokens",0) or 0; o=u.get("output_tokens",0) or 0; r=u.get("cache_read_input_tokens",0) or 0
    return (i*p[0]+o*p[1]+r*p[2]+w5*p[3]+w1*p[4])/1e6, (w1+w5), r, i
corte=time.time()-DIAS*86400
raiz=os.path.expanduser("~/.claude/projects")
files=[a for a in glob.glob(raiz+"/**/*.jsonl",recursive=True) if os.path.getmtime(a)>=corte]
seen=set()
by_type=defaultdict(lambda:[0,0.0,0.0,0])  # agentes, custo, custo se sonnet, passos
by_model=defaultdict(float)
ctx_bins=defaultdict(int); ctx_cost=defaultdict(float)
steps_per=[]  # (n, cost, type)
first_ctx=[]; first_by_type=defaultdict(list)
tr_tok=defaultdict(float); tr_n=defaultdict(int)
wr_total=0.0; wr_explained=0.0  # escrita sub (tokens) vs tool_result tokens estimados
outro=[]  # (custo escrita, tokens escritos, tr_tokens desde passo anterior, ttl gap)
wr_cat=defaultdict(float)
cur_cost_w=0
sub_tot=0.0;main_tot=0.0
for arq in files:
    sub="/subagents/" in arq
    meta={}
    if sub:
        try: meta=json.load(open(arq[:-6]+".meta.json"))
        except: pass
    atype=meta.get("agentType","?") if sub else "main"
    events=[]; tooln={}
    try:
        for ln in open(arq,encoding="utf-8",errors="replace"):
            if '"usage"' not in ln and '"tool_result"' not in ln: continue
            try: d=json.loads(ln)
            except: continue
            m=d.get("message") or {}
            if not isinstance(m,dict): continue
            t=ep(d.get("timestamp",""))
            c=m.get("content")
            if d.get("type")=="assistant":
                if isinstance(c,list):
                    for b in c:
                        if isinstance(b,dict) and b.get("type")=="tool_use": tooln[b.get("id")]=b.get("name","?")
                if m.get("id") and m.get("usage"): events.append(("a",t,m["id"],m.get("model"),m["usage"]))
            elif d.get("type")=="user" and isinstance(c,list):
                for b in c:
                    if isinstance(b,dict) and b.get("type")=="tool_result":
                        cc=b.get("content"); n=0; img=0
                        if isinstance(cc,str): n=len(cc)
                        elif isinstance(cc,list):
                            for x in cc:
                                if isinstance(x,dict):
                                    if x.get("type")=="text": n+=len(x.get("text",""))
                                    elif x.get("type")=="image": img+=1
                        tok=n/3.5+img*1600
                        nm=tooln.get(b.get("tool_use_id"),"?")
                        if nm.startswith("mcp__"): nm="mcp:"+nm.split("__")[1][:25]+("(img)" if img else "")
                        elif img: nm=nm+"(img)"
                        events.append(("r",t,nm,tok))
    except OSError: continue
    # dedupe assistant, order
    ev=sorted([e for e in events if e[1]],key=lambda e:e[1])
    prev_t=None; prev_f=None; pend=0.0; n=0; ac=0.0; acs=0.0; first=True
    for e in ev:
        if e[0]=="r":
            if e[1]>=corte:
                tr_tok[e[2]]+=e[3]; tr_n[e[2]]+=1
            pend+=e[3]; continue
        _,t,mid,model,u=e
        if mid in seen or t<corte: pend=0; continue
        seen.add(mid); f=fam(model)
        if not f: continue
        c,w,r,i=cost(f,u); cs=cost(f,u,"sonnet")[0]
        ctx=w+r+i
        by_model[f]+=c
        if sub: sub_tot+=c
        else: main_tot+=c
        if sub:
            n+=1; ac+=c; acs+=cs
            b=">300K" if ctx>300000 else ">150K" if ctx>150000 else ">100K" if ctx>100000 else "<=100K"
            ctx_bins[b]+=1; ctx_cost[b]+=c
            wr_total+=w
            if first:
                first_ctx.append(ctx); first_by_type[atype].append(ctx); first=False
                wr_cat["1o passo (prefixo+tarefa)"]+=w
            else:
                # classificar escrita
                ttl=300
                gap=(t-prev_t) if prev_t else 0
                if gap>ttl: wr_cat["rewrite apos espera>5min"]+=w
                elif w>0: 
                    # crescimento: comparar com tool_results pendentes
                    wr_cat["crescimento (inclui tool_result+output anterior)"]+=w
                    wr_explained+=min(w,pend)
                    if w>30000 and w>r: outro.append((w,pend,gap))
        else:
            pass
        pend=0; prev_t=t; prev_f=f
    if sub and n:
        steps_per.append((n,ac,atype)); 
        x=by_type[atype]; x[0]+=1; x[1]+=ac; x[2]+=acs; x[3]+=n
print(f"arquivos {len(files)} | sub total {sub_tot:.0f} main {main_tot:.0f}")
print("== 1. por tipo de agente (n, custo, custo se tudo Sonnet, passos)")
for k,v in sorted(by_type.items(),key=lambda x:-x[1][1]):
    print(f"{k:22s} n={v[0]:4d} US${v[1]:8.1f} sonnet=US${v[2]:8.1f} passos={v[3]:6d} custo/agente={v[1]/v[0]:.2f}")
print("por modelo",{k:round(v,1) for k,v in by_model.items()})
print("== 2. contexto por passo (subagente)")
for b in ["<=100K",">100K",">150K",">300K"]: print(b,ctx_bins[b],f"US${ctx_cost[b]:.1f}")
ns=sorted(x[0] for x in steps_per)
print("passos/agente: n",len(ns),"mediana",st.median(ns),"p90",ns[int(len(ns)*.9)],"max",ns[-1])
for lim in (50,100,200,300): 
    sel=[x for x in steps_per if x[0]>=lim]; print(f">= {lim} passos: {len(sel)} agentes US${sum(x[1] for x in sel):.1f}")
print("top 8 agentes mais caros:",[(x[2],x[0],round(x[1],1)) for x in sorted(steps_per,key=lambda x:-x[1])[:8]])
print("== 3. escrita sub tokens",round(wr_total/1e6,1),"M")
for k,v in wr_cat.items(): print(f"  {k}: {v/1e6:.1f}M tok")
print("  tool_result estimado cobrindo escrita de crescimento: ",round(wr_explained/1e6,1),"M")
print("  'outro' (>30K, w>r): n",len(outro),"w tot",round(sum(o[0] for o in outro)/1e6,1),"M; tool_result pendente",round(sum(min(o[0],o[1]) for o in outro)/1e6,1),"M")
print("top tool_result por tokens estimados (chars/3.5, img 1600):")
for k,v in sorted(tr_tok.items(),key=lambda x:-x[1])[:12]: print(f"  {k:30s} {v/1e6:7.2f}M tok  n={tr_n[k]}  media={v/tr_n[k]:.0f}")
print("== 4. 1o passo: n",len(first_ctx),"mediana",st.median(first_ctx),"media",round(st.mean(first_ctx)),"p10",sorted(first_ctx)[len(first_ctx)//10],"p90",sorted(first_ctx)[int(len(first_ctx)*.9)])
for k,v in sorted(first_by_type.items(),key=lambda x:-len(x[1])): print(f"  {k:22s} n={len(v)} mediana={st.median(v):.0f}")
