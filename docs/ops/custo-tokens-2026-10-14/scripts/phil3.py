import glob,json,os,time
from collections import defaultdict
corte=time.time()-5*86400
files=[a for a in glob.glob(os.path.expanduser("~/.claude/projects")+"/**/subagents/*.jsonl",recursive=True) if os.path.getmtime(a)>=corte]
sz=defaultdict(int); cnt=defaultdict(int); ls=0
for a in files:
    for ln in open(a,encoding="utf-8",errors="replace"):
        try:d=json.loads(ln)
        except:continue
        t=d.get("type"); m=d.get("message") if isinstance(d.get("message"),dict) else {}
        c=m.get("content")
        if isinstance(c,list):
            for b in c:
                if isinstance(b,dict):
                    k=(t,b.get("type")); 
                    if b.get("type")=="tool_result":
                        cc=b.get("content"); 
                        s=len(cc) if isinstance(cc,str) else sum(len(x.get("text","")) for x in cc if isinstance(x,dict))
                        # image bytes
                        if isinstance(cc,list): s+=sum(len(json.dumps(x)) for x in cc if isinstance(x,dict) and x.get("type")!="text")
                    elif b.get("type")=="text": s=len(b.get("text",""))
                    elif b.get("type")=="thinking": s=len(b.get("thinking",""))+len(b.get("signature",""))
                    elif b.get("type")=="tool_use": s=len(json.dumps(b.get("input")))
                    else: s=len(json.dumps(b))
                    sz[k]+=s; cnt[k]+=1
        elif isinstance(c,str):
            k=(t,"str"); sz[k]+=len(c); cnt[k]+=1
        else:
            k=(t,"other"); sz[k]+=len(ln); cnt[k]+=1
for k,v in sorted(sz.items(),key=lambda x:-x[1]): print(k,cnt[k],f"{v/1e6:.1f}MB ~{v/3.5/1e6:.1f}M tok")
