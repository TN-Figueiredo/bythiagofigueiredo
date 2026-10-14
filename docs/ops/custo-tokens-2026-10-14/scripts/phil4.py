import glob,json,os,time
from collections import defaultdict
corte=time.time()-5*86400
files=[a for a in glob.glob(os.path.expanduser("~/.claude/projects")+"/**/subagents/*.jsonl",recursive=True) if os.path.getmtime(a)>=corte]
sz=defaultdict(int);cnt=defaultdict(int); ex={}
for a in files:
    for ln in open(a,encoding="utf-8",errors="replace"):
        if '"attachment"' not in ln[:60] and '"type":"attachment"' not in ln[:200]: continue
        try:d=json.loads(ln)
        except:continue
        if d.get("type")!="attachment":continue
        at=d.get("attachment") or {}
        k=at.get("type"); 
        sz[k]+=len(ln); cnt[k]+=1
        if k not in ex: ex[k]=ln[:300]
for k,v in sorted(sz.items(),key=lambda x:-x[1]): print(k,cnt[k],f"{v/1e6:.1f}MB avg {v/cnt[k]:.0f}B")
for k in list(ex)[:6]: print(k,ex[k][:250])
