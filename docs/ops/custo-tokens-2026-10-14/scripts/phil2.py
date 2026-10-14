import glob,json,os,time,statistics as st
from datetime import datetime
from collections import defaultdict
P={"opus":(4.0,20.0,0.20,5.0,8.0),"sonnet":(2.0,10.0,0.10,2.5,4.0)}
def ep(ts):
    try: return datetime.fromisoformat(ts.replace("Z","+00:00")).timestamp()
    except: return None
corte=time.time()-5*86400
files=[a for a in glob.glob(os.path.expanduser("~/.claude/projects")+"/**/*.jsonl",recursive=True) if os.path.getmtime(a)>=corte]
seen=set()
first=defaultdict(float); firstn=0; firstw=firstr=0
outsub=0; outmain=0; outcost=0
outro=[]; ttl1h=0; w1h=w5=0
for a in files:
    sub="/subagents/" in a
    msgs={}
    for ln in open(a,encoding="utf-8",errors="replace"):
        if '"usage"' not in ln: continue
        try:d=json.loads(ln)
        except:continue
        m=d.get("message") or {}
        if d.get("type")!="assistant" or not isinstance(m,dict) or not m.get("id") or not m.get("usage"):continue
        msgs[m["id"]]=(ep(d.get("timestamp","")),m.get("model"),m["usage"])
    prev=None;idx=0
    for mid,(t,model,u) in sorted(msgs.items(),key=lambda x:x[1][0] or 0):
        if not t or t<corte or mid in seen: continue
        seen.add(mid)
        f="opus" if "opus" in (model or "") else "sonnet" if "sonnet" in (model or "") else None
        if not f: continue
        p=P[f];cc=u.get("cache_creation") or {}
        a1=cc.get("ephemeral_1h_input_tokens",0) or 0;a5=cc.get("ephemeral_5m_input_tokens",0) or 0
        if not(a1 or a5):a5=u.get("cache_creation_input_tokens",0) or 0
        r=u.get("cache_read_input_tokens",0) or 0;i=u.get("input_tokens",0) or 0;o=u.get("output_tokens",0) or 0
        ctx=a1+a5+r+i
        if sub:
            w1h+=a1;w5+=a5;outsub+=o;outcost+=o*p[1]/1e6
            if idx==0:
                firstn+=1;firstw+=a1+a5;firstr+=r
                first["write_cost"]+=(a1*p[4]+a5*p[3])/1e6;first["read_cost"]+=r*p[2]/1e6;first["in"]+=i*p[0]/1e6
                first["write_cost_if_5m"]+=(a1+a5)*p[3]/1e6
        else: outmain+=o
        if sub and idx>0 and a1+a5>30000 and a1+a5>r:
            gap=t-prev[0]
            if gap<=300: outro.append((a1+a5,r,prev[1],ctx,gap,(a1*p[4]+a5*p[3])/1e6))
        prev=(t,ctx);idx+=1
print("1o passo: n",firstn,"write tok",firstw/1e6,"M read tok",firstr/1e6,"M  custos",dict(first))
print("sub output tokens",outsub/1e6,"M US$",outcost," ; sub write 1h",w1h/1e6,"5m",w5/1e6)
print("outro sub (<=5min gap, w>30K, w>r): n",len(outro),"custo",sum(x[5] for x in outro))
drops=[x for x in outro if x[3]<x[2]*0.7]
print(" com queda de contexto (compactacao) n",len(drops),"custo",sum(x[5] for x in drops))
big=[x for x in outro if x[3]>=x[2]*0.7]
print(" sem queda (salto):n",len(big),"custo",sum(x[5] for x in big),"salto medio tok",st.mean(x[3]-x[2] for x in big) if big else 0)
