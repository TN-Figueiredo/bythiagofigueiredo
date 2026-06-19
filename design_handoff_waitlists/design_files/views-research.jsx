/* ============================================================
   RESEARCH MODULE — Foco · Pesquisas · Decisões
   Decisions layer that frames the research library.
   Model: Pesquisas (Cowork escreve) → você decide → Foco do trimestre.
   O Cowork PROPÕE; você CONFIRMA. Nada vira foco sozinho.
   ============================================================ */
const STORE_KEY = "tf-research-v3";
const EXPLAIN_KEY = "tf-research-explainer-v1";
function loadResearchState() {
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && s.v === 3) return s; } catch {}
  return null;
}
function seedState() {
  const d = window.RESEARCH;
  return { v: 3, pesquisas: JSON.parse(JSON.stringify(d.PESQUISAS)), decisoes: JSON.parse(JSON.stringify(d.DECISOES)), focos: JSON.parse(JSON.stringify(d.FOCOS)) };
}

const DRIVES = ["Roteiros", "Newsletter", "Thumbnails", "Script de vídeo"];
function temaById(id) { return window.RESEARCH.TEMAS.find(t => t.id === id); }

/* ---------------- small atoms ---------------- */
function TemaDot({ id, label = true, size = 8 }) {
  const t = temaById(id); if (!t) return null;
  return <span className="tema-tag"><span className="tdot" style={{ width: size, height: size, background: t.color }} />{label && t.short}</span>;
}
function StatusBadge({ status }) {
  const st = window.RESEARCH.STATUS[status]; if (!st) return null;
  return <span className={"badge " + (st.kind === "muted" ? "" : st.kind)}><span className="dot" style={{ background: st.dot }} />{st.label}</span>;
}
function HorizonChip({ id }) {
  const h = window.RESEARCH.HORIZONS.find(x => x.id === id); if (!h) return null;
  return <span className="hz-chip" style={{ "--hc": h.color }}><Icon name={h.icon} size={12} />{h.label}</span>;
}
/* who authored a focus/decision: você vs Cowork */
function AuthorLine({ author, state }) {
  if (state === "proposto" || author === "cowork") return <span className="auth cowork"><Icon name="sparkles" size={12} /> Proposto pelo Cowork</span>;
  return <span className="auth you"><Icon name="edit" size={12} /> Definido por você</span>;
}

/* ---------------- research card ---------------- */
function ResearchCard({ doc, onOpen }) {
  return (
    <button className={"rcard" + (doc.pinned ? " pinned" : "")} onClick={() => onOpen(doc)}>
      <div className="rcard-top">
        <TemaDot id={doc.tema} />
        <div className="grow" />
        <StatusBadge status={doc.status} />
      </div>
      <div className="rcard-title">{doc.title}</div>
      <div className="rcard-sum">{doc.summary}</div>
      <div className="rcard-foot">
        <SourceTag source={doc.source} />
        <span className="rmeta"><Icon name="zap" size={12} />{doc.takeaways.length}</span>
        {doc.decisions.length > 0 && <span className="rmeta"><Icon name="target" size={12} />{doc.decisions.length}</span>}
        <div className="grow" />
        <span className="rmeta dim">{doc.updated}</span>
      </div>
      {doc.pinned && <span className="rcard-pin" title="No foco atual"><Icon name="pin" size={13} /></span>}
    </button>
  );
}

/* ---------------- decision card ---------------- */
function DecisionCard({ d, onEdit, onOpen, onOpenDoc }) {
  const ds = window.RESEARCH.DECISION_STATUS[d.status];
  const tone = ds.kind === "muted" ? "var(--text-dim)" : "var(--" + ds.kind + ")";
  return (
    <div className={"dcard" + (d.status === "arquivado" ? " arch" : "")} onClick={() => onOpen && onOpen(d)} role="button" tabIndex={0}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && onOpen) { e.preventDefault(); onOpen(d); } }}>
      <div className="dcard-top">
        <span className="dstat" style={{ "--ds": tone }}><Icon name={ds.icon} size={12} />{ds.label}</span>
        <HorizonChip id={d.horizon} />
        <TemaDot id={d.tema} />
        <div className="grow" />
        <span className="dim fs11 mono">{d.date}</span>
        <button className="icon-btn bare dcard-edit" title="Editar decisão" onClick={(e) => { e.stopPropagation(); onEdit(d); }}><Icon name="edit" size={14} /></button>
      </div>
      <div className="dcard-stmt">{d.statement}</div>
      <div className="dcard-why">{d.rationale}</div>
      <div className="dcard-links">
        {(d.from || []).map(rid => {
          const doc = window.__researchDocs?.[rid];
          return doc ? <button key={rid} className="link-chip" onClick={(e) => { e.stopPropagation(); onOpenDoc(doc); }}><Icon name="research" size={11} /> {doc.title}</button> : null;
        })}
        {(d.drives || []).map(w => <span key={w} className="drive-chip"><Icon name="arrowright" size={11} />{w}</span>)}
        <div className="grow" />
        <span className="dcard-open">Abrir <Icon name="arrowright" size={12} /></span>
      </div>
    </div>
  );
}

/* ---------------- explainer (dismissible, teaches the loop) ---------------- */
function ExplainerStrip({ onClose, onPropose }) {
  const steps = [
    { ic: "research", c: "var(--c-courses)", t: "Pesquisas", s: "O Cowork investiga e escreve. Você edita." },
    { ic: "checkcheck", c: "var(--c-pipeline)", t: "Decisões", s: "Você transforma takeaways em decisões." },
    { ic: "target", c: "var(--accent)", t: "Foco", s: "Uma decisão estratégica com prazo vira o foco do trimestre." },
  ];
  return (
    <div className="explainer">
      <button className="explainer-x" onClick={onClose} title="Entendi"><Icon name="x" size={15} /></button>
      <div className="explainer-head">
        <Icon name="info" size={15} style={{ color: "var(--accent-text)" }} />
        <span>Como o Foco funciona — <b>você decide, o Cowork propõe</b></span>
      </div>
      <div className="explainer-flow">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div className="ex-step">
              <span className="ex-ico" style={{ "--xc": s.c }}><Icon name={s.ic} size={15} /></span>
              <div><div className="ex-t">{s.t}</div><div className="ex-s">{s.s}</div></div>
            </div>
            {i < steps.length - 1 && <Icon name="arrowright" size={15} className="ex-arrow" />}
          </React.Fragment>
        ))}
      </div>
      <div className="explainer-foot">
        <span className="dim fs12">Nada vira foco automaticamente — o Cowork só sugere; a confirmação é sempre sua.</span>
        <button className="btn sm" onClick={onPropose}><Icon name="sparkles" size={14} /> Pedir proposta ao Cowork</button>
      </div>
    </div>
  );
}

/* ---------------- focus hero (active) ---------------- */
function FocusHero({ foco, basedOnDocs, decisionsCount, onEdit, onOpenDoc }) {
  return (
    <div className="focus-hero">
      <div className="fh-bar" />
      <div className="fh-body">
        <div className="fh-eyebrow">
          <Icon name="target" size={14} /><span>Foco · agora</span>
          <span className="fh-window">{foco.window}</span>
          <span className="fh-prov"><AuthorLine author={foco.author} state={foco.state} /></span>
        </div>
        <h2 className="fh-title">{foco.title}</h2>
        <p className="fh-thesis">{foco.thesis}</p>
        <div className="fh-based">
          <span className="fh-based-lbl">Com base em</span>
          {basedOnDocs.length === 0 && <span className="dim fs12">nenhuma pesquisa ainda</span>}
          {basedOnDocs.map(d => <button key={d.id} className="based-chip" onClick={() => onOpenDoc(d)}><Icon name="research" size={11} /> {d.title}</button>)}
        </div>
        <div className="fh-bottom">
          <div className="fh-temas">{foco.temas.map(t => <TemaDot key={t} id={t} />)}</div>
          <span className="fh-metric"><Icon name="gauge" size={13} /> {foco.metric}</span>
          <span className="fh-metric"><Icon name="target" size={13} /> {decisionsCount} {decisionsCount === 1 ? "decisão ligada" : "decisões ligadas"}</span>
          <div className="grow" />
          <button className="btn sm" onClick={() => onEdit(foco)}><Icon name="edit" size={14} /> Editar foco</button>
        </div>
      </div>
      <div className="fh-stamp" aria-hidden="true"><span>FOCO</span><i /></div>
    </div>
  );
}

/* ---------------- focus zero state (pristine / cleared) ----------------
   One composed hero that folds the teaching (Pesquisas → Decisões → Foco)
   into a single branded panel. Context-aware footer. Replaces the old
   5-box stack (explainer + dashed empty + empty board + empty split). */
function FocusZeroState({ pesquisasCount, onPropose, onCreate, onNewPesquisa }) {
  const hasResearch = pesquisasCount > 0;
  const STEPS = [
    { ic: "research", c: "var(--c-courses)", t: "Pesquisas", s: "O Cowork investiga e escreve." },
    { ic: "checkcheck", c: "var(--c-pipeline)", t: "Decisões", s: "Você decide o que importa." },
    { ic: "target", c: "var(--accent)", t: "Foco", s: "A aposta do trimestre.", dest: true },
  ];
  return (
    <div className="fz">
      <span className="fz-bar" aria-hidden="true" />
      <div className="fz-main">
        <div className="fz-eyebrow"><Icon name="target" size={14} /> Foco do trimestre <span className="fz-tag">não definido</span></div>
        <h2 className="fz-title">Escolha a aposta do trimestre</h2>
        <p className="fz-sub">O foco é a narrativa única em torno da qual roteiros, newsletter e thumbnails se organizam. <b>Você decide</b> — o Cowork só propõe.</p>

        <div className="fz-flow">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.t}>
              <div className={"fz-step" + (s.dest ? " dest" : "")} style={{ "--sc": s.c }}>
                <span className="fz-step-ic"><Icon name={s.ic} size={16} /></span>
                <div className="fz-step-tx"><span className="fz-step-t">{s.t}</span><span className="fz-step-s">{s.s}</span></div>
              </div>
              {i < STEPS.length - 1 && <span className="fz-arrow" aria-hidden="true"><Icon name="arrowright" size={14} /></span>}
            </React.Fragment>
          ))}
        </div>

        <div className="fz-actions">
          <button className="btn primary" onClick={onPropose}><Icon name="sparkles" size={15} /> Pedir proposta ao Cowork</button>
          <button className="btn" onClick={onCreate}><Icon name="plus" size={15} /> Definir manualmente</button>
        </div>

        <div className="fz-foot">
          {hasResearch
            ? <><Icon name="info" size={13} /> Você já tem <b>{pesquisasCount} {pesquisasCount === 1 ? "pesquisa" : "pesquisas"}</b> — o Cowork pode propor um foco a partir delas. A proposta chega como rascunho pra você confirmar.</>
            : <><Icon name="info" size={13} /> Sem pesquisas ainda. Comece na aba <button className="fz-link" onClick={onNewPesquisa}>Pesquisas</button> — o Cowork investiga e escreve; depois viram decisões e foco.</>}
        </div>
      </div>
      <div className="fz-aura" aria-hidden="true"><i /><i /><i /><b /></div>
    </div>
  );
}

/* ---------------- horizon board ---------------- */
function HorizonBoard({ focos, onEdit, onConfirm, onAdd }) {
  const H = window.RESEARCH.HORIZONS, FS = window.RESEARCH.FOCO_STATE;
  return (
    <div className="hz-board">
      {H.map(h => {
        const items = focos.filter(f => f.horizon === h.id);
        return (
          <div key={h.id} className="hz-col">
            <div className="hz-col-head" style={{ "--hc": h.color }}>
              <span className="hz-dot"><Icon name={h.icon} size={13} /></span>
              <div><div className="hz-name">{h.label}</div><div className="hz-sub">{h.sub}</div></div>
              <button className="hz-add" title="Nova aposta" onClick={() => onAdd(h.id)}><Icon name="plus" size={15} /></button>
            </div>
            <div className="hz-col-body">
              {items.map(f => {
                const fs = FS[f.state] || FS.rascunho;
                return (
                  <div key={f.id} className={"hz-card st-" + f.state} style={{ "--fc": fs.tone }}>
                    <div className="hz-card-head">
                      <span className="hz-state">{f.state === "ativo" ? <i className="hz-live-dot" /> : <Icon name={f.state === "proposto" ? "sparkles" : "edit"} size={11} />}{fs.label}</span>
                      <button className="icon-btn bare hz-edit" title="Editar" onClick={() => onEdit(f)}><Icon name="edit" size={13} /></button>
                    </div>
                    <div className="hz-card-win mono">{f.window}</div>
                    <div className="hz-card-title">{f.title}</div>
                    <div className="hz-card-thesis">{f.thesis}</div>
                    <div className="hz-card-foot">
                      <div className="hz-card-temas">{f.temas.map(t => <span key={t} className="tdot" style={{ background: temaById(t)?.color }} />)}</div>
                      {f.state === "proposto" && <button className="btn sm primary hz-confirm" onClick={() => onConfirm(f)}><Icon name="check" size={13} /> Confirmar</button>}
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <button className="hz-empty" onClick={() => onAdd(h.id)}><Icon name="plus" size={14} /> Adicionar aposta</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- decision drawer (author / edit a decision) ---------------- */
function DecisionDrawer({ initial, pesquisas, onClose, onSave }) {
  const isNew = !initial.id;
  const [statement, setStatement] = useState(initial.statement || "");
  const [rationale, setRationale] = useState(initial.rationale || "");
  const [context, setContext] = useState(initial.context || "");
  const [horizon, setHorizon] = useState(initial.horizon || "agora");
  const [tema, setTema] = useState(initial.tema || "asia");
  const [status, setStatus] = useState(initial.status || "decidido");
  const [metric, setMetric] = useState(initial.metric || "");
  const [revisit, setRevisit] = useState(initial.revisit || "");
  const [drives, setDrives] = useState(initial.drives || []);
  const [from, setFrom] = useState(initial.from || []);
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const H = window.RESEARCH.HORIZONS, DS = window.RESEARCH.DECISION_STATUS, TM = window.RESEARCH.TEMAS;

  const save = () => {
    onSave({
      ...initial, id: initial.id || ("d-" + Date.now()),
      statement: statement.trim() || "Decisão sem enunciado",
      rationale: rationale.trim(), context: context.trim(),
      horizon, tema, status,
      metric: metric.trim(), revisit: revisit.trim(),
      drives, from,
      date: initial.date || "hoje",
      history: initial.history || [{ label: DS[status].label, date: "hoje", note: "Decisão registrada." }],
    });
    onClose();
  };

  return (
    <React.Fragment>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <Icon name="checkcheck" size={17} style={{ color: "var(--accent-text)" }} />
          <span className="dt">{isNew ? "Nova decisão" : "Editar decisão"}</span>
          <div className="grow" />
          <button className="icon-btn bare" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="drawer-body">
          <div className="fgroup">
            <span className="flabel">A decisão</span>
            <textarea className="finput" rows={2} value={statement} onChange={e => setStatement(e.target.value)} placeholder="Ex.: Todo vídeo de viagem mostra o contraste de preço em dólar." />
          </div>
          <div className="fgroup">
            <span className="flabel">Por quê — o racional</span>
            <textarea className="finput" rows={3} value={rationale} onChange={e => setRationale(e.target.value)} placeholder="A lógica curta por trás da decisão." />
          </div>
          <div className="fgroup">
            <span className="flabel">Contexto <span className="dim">· opcional</span></span>
            <textarea className="finput" rows={3} value={context} onChange={e => setContext(e.target.value)} placeholder="O cenário que torna a decisão necessária." />
          </div>
          <div className="fgroup">
            <span className="flabel">Status</span>
            <div className="seg" style={{ width: "100%" }}>
              {Object.entries(DS).map(([k, v]) => <button key={k} className={status === k ? "on" : ""} style={{ flex: 1 }} onClick={() => setStatus(k)}>{v.label}</button>)}
            </div>
          </div>
          <div className="row gap-8" style={{ alignItems: "flex-start" }}>
            <div className="fgroup grow"><span className="flabel">Métrica</span><input className="finput" value={metric} onChange={e => setMetric(e.target.value)} placeholder="Retenção ≥ 45%" /></div>
            <div className="fgroup grow"><span className="flabel">Revisitar</span><input className="finput" value={revisit} onChange={e => setRevisit(e.target.value)} placeholder="Fim de ago 2026" /></div>
          </div>
          <div className="fgroup">
            <span className="flabel">Horizonte</span>
            <div className="seg" style={{ width: "100%" }}>
              {H.map(h => <button key={h.id} className={horizon === h.id ? "on" : ""} style={{ flex: 1 }} onClick={() => setHorizon(h.id)}>{h.label}</button>)}
            </div>
          </div>
          <div className="fgroup">
            <span className="flabel">Tema</span>
            <div className="row gap-8 wrap">
              {TM.map(t => <button key={t.id} className={"chip sm" + (tema === t.id ? " on" : "")} onClick={() => setTema(t.id)}><span className="cdot" style={{ background: t.color }} /> {t.short}</button>)}
            </div>
          </div>
          <div className="fgroup">
            <span className="flabel">Alimenta</span>
            <div className="row gap-8 wrap">
              {DRIVES.map(w => <button key={w} className={"chip sm" + (drives.includes(w) ? " on" : "")} onClick={() => toggle(drives, setDrives, w)}><Icon name="arrowright" size={11} /> {w}</button>)}
            </div>
          </div>
          <div className="fsection">Pesquisa que fundamenta</div>
          <div className="fgroup">
            <div className="col gap-7">
              {(pesquisas || []).filter(d => d.status !== "arquivada").map(d => (
                <button key={d.id} className={"pick-row" + (from.includes(d.id) ? " on" : "")} onClick={() => toggle(from, setFrom, d.id)}>
                  <span className="pick-check">{from.includes(d.id) && <Icon name="check" size={12} />}</span>
                  <span className="cdot" style={{ background: temaById(d.tema)?.color }} />
                  <span className="truncate">{d.title}</span>
                </button>
              ))}
            </div>
            <span className="fhint">As pesquisas que sustentam a decisão. Aparecem no detalhe.</span>
          </div>
          {!isNew && (
            <React.Fragment>
              <div className="fsection danger">Arquivar</div>
              <button className="btn" style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)", background: "var(--danger-s)", width: "100%" }}
                onClick={() => { onSave({ ...initial, status: "arquivado" }); onClose(); }}>
                <Icon name="archive" size={15} /> Arquivar decisão
              </button>
            </React.Fragment>
          )}
        </div>
        <div className="drawer-foot">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={save}><Icon name="check" size={15} /> {isNew ? "Registrar decisão" : "Salvar"}</button>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---------------- focus drawer (author / edit / promote) ---------------- */
function FocusDrawer({ initial, pesquisas, onClose, onSave, onActivate }) {
  const isNew = !initial.id;
  const [title, setTitle] = useState(initial.title || "");
  const [thesis, setThesis] = useState(initial.thesis || "");
  const [horizon, setHorizon] = useState(initial.horizon || "agora");
  const [windowTxt, setWindowTxt] = useState(initial.window || "");
  const [metric, setMetric] = useState(initial.metric || "");
  const [temas, setTemas] = useState(initial.temas || []);
  const [basedOn, setBasedOn] = useState(initial.basedOn || []);
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const build = (over) => ({
    ...initial, id: initial.id || ("f-" + Date.now()),
    title: title.trim() || "Foco sem título", thesis: thesis.trim(), horizon, window: windowTxt.trim() || "a definir",
    metric: metric.trim() || "—", temas, basedOn, author: initial.author || "thiago",
    state: initial.state || "rascunho", created: initial.created || "hoje", active: !!initial.active, ...over,
  });
  const save = () => { onSave(build({})); onClose(); };
  const activate = () => { onActivate(build({ horizon: "agora", state: "ativo", active: true })); onClose(); };
  const isProposed = initial.state === "proposto";
  const H = window.RESEARCH.HORIZONS;
  return (
    <React.Fragment>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <Icon name="target" size={17} style={{ color: "var(--accent-text)" }} />
          <span className="dt">{isNew ? "Definir foco" : isProposed ? "Revisar proposta" : "Editar foco"}</span>
          <div className="grow" />
          <button className="icon-btn bare" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="drawer-body">
          {isProposed && <div className="drawer-banner"><Icon name="sparkles" size={14} /> Proposta do Cowork a partir das suas pesquisas. Ajuste o que quiser e confirme.</div>}
          <div className="fgroup">
            <span className="flabel">A aposta</span>
            <input className="finput" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: A transição Brasil → Ásia" />
          </div>
          <div className="fgroup">
            <span className="flabel">Tese — por que é o foco</span>
            <textarea className="finput" rows={4} value={thesis} onChange={e => setThesis(e.target.value)} placeholder="A narrativa em torno da qual o trimestre se organiza…" />
          </div>
          <div className="row gap-8" style={{ alignItems: "flex-start" }}>
            <div className="fgroup grow"><span className="flabel">Janela</span><input className="finput" value={windowTxt} onChange={e => setWindowTxt(e.target.value)} placeholder="Jun – Ago 2026" /></div>
            <div className="fgroup grow"><span className="flabel">Métrica</span><input className="finput" value={metric} onChange={e => setMetric(e.target.value)} placeholder="8 de 11 vídeos do trimestre" /></div>
          </div>
          <div className="fgroup">
            <span className="flabel">Horizonte</span>
            <div className="seg" style={{ width: "100%" }}>
              {H.map(h => <button key={h.id} className={horizon === h.id ? "on" : ""} style={{ flex: 1 }} onClick={() => setHorizon(h.id)}>{h.label}</button>)}
            </div>
          </div>
          <div className="fgroup">
            <span className="flabel">Temas</span>
            <div className="row gap-8 wrap">
              {window.RESEARCH.TEMAS.map(t => <button key={t.id} className={"chip sm" + (temas.includes(t.id) ? " on" : "")} onClick={() => toggle(temas, setTemas, t.id)}><span className="cdot" style={{ background: t.color }} /> {t.short}</button>)}
            </div>
          </div>
          <div className="fsection">Baseado em quê</div>
          <div className="fgroup">
            <div className="col gap-7">
              {pesquisas.filter(d => d.status !== "arquivada").map(d => (
                <button key={d.id} className={"pick-row" + (basedOn.includes(d.id) ? " on" : "")} onClick={() => toggle(basedOn, setBasedOn, d.id)}>
                  <span className="pick-check">{basedOn.includes(d.id) && <Icon name="check" size={12} />}</span>
                  <span className="cdot" style={{ background: temaById(d.tema)?.color }} />
                  <span className="truncate">{d.title}</span>
                </button>
              ))}
            </div>
            <span className="fhint">As pesquisas que fundamentam a aposta. Aparecem no card do foco.</span>
          </div>
          {!isNew && (
            <React.Fragment>
              <div className="fsection danger">Arquivar</div>
              <button className="btn" style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)", background: "var(--danger-s)", width: "100%" }}
                onClick={() => { onSave(build({ state: "arquivado", active: false, archived: true })); onClose(); }}>
                <Icon name="archive" size={15} /> {initial.active ? "Encerrar este foco" : "Arquivar aposta"}
              </button>
              {initial.active && <span className="fhint" style={{ marginTop: 7 }}>Encerra o foco do trimestre. Você volta à tela de definir foco.</span>}
            </React.Fragment>
          )}
        </div>
        <div className="drawer-foot">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          {(isNew || isProposed || !initial.active)
            ? <><button className="btn" onClick={save}>Salvar como {isProposed ? "proposta" : "rascunho"}</button>
                <button className="btn primary" onClick={activate}><Icon name="check" size={15} /> {isProposed ? "Confirmar foco" : "Tornar foco ativo"}</button></>
            : <button className="btn primary" onClick={save}><Icon name="check" size={15} /> Salvar</button>}
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---------------- reset focos (recomeçar) ---------------- */
function ResetFocosButton({ onReset }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="reset-wrap">
      <button className="reset-btn" onClick={() => setConfirm(c => !c)}><Icon name="refresh" size={13} /> Recomeçar</button>
      {confirm && (
        <React.Fragment>
          <div className="reset-scrim" onClick={() => setConfirm(false)} />
          <div className="reset-pop" role="dialog">
            <div className="rp-title"><Icon name="warn" size={14} /> Recomeçar o trimestre?</div>
            <div className="rp-tx">Arquiva o foco ativo e todas as apostas do board, voltando à tela de definir foco. <b>Pesquisas e decisões são mantidas.</b></div>
            <div className="rp-actions">
              <button className="btn sm" onClick={() => setConfirm(false)}>Cancelar</button>
              <button className="btn sm" style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 38%, transparent)", background: "var(--danger-s)" }} onClick={() => { onReset(); setConfirm(false); }}><Icon name="refresh" size={13} /> Recomeçar</button>
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

/* ---------------- filters ---------------- */
const STATUS_FILTERS = [["all", "Todas"], ["fresca", "Frescas"], ["analise", "Em análise"], ["aplicada", "Aplicadas"], ["arquivada", "Arquivadas"]];

/* ============================================================
   MAIN VIEW
   ============================================================ */
function ResearchView() {
  const [st, setSt] = useState(() => loadResearchState() || seedState());
  useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch {} }, [st]);
  const [explain, setExplain] = useState(() => { try { return localStorage.getItem(EXPLAIN_KEY) !== "1"; } catch { return true; } });
  const dismissExplain = () => { setExplain(false); try { localStorage.setItem(EXPLAIN_KEY, "1"); } catch {} };

  const [tab, setTab] = useState("foco");
  const [activeTema, setActiveTema] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const [openDocId, setOpenDocId] = useState(null);
  const [openDecisionId, setOpenDecisionId] = useState(null);
  const [docStartMode, setDocStartMode] = useState("read");
  const [hzFilter, setHzFilter] = useState("all");
  const [drawer, setDrawer] = useState(null); // { kind: "decision"|"focus", initial }

  const decisionsById = useMemo(() => Object.fromEntries(st.decisoes.map(d => [d.id, d])), [st.decisoes]);
  const docsById = useMemo(() => Object.fromEntries(st.pesquisas.map(d => [d.id, d])), [st.pesquisas]);
  useEffect(() => { window.__researchDocs = docsById; }, [docsById]);

  const activeFoco = st.focos.find(f => f.active && f.state === "ativo" && !f.archived);
  const boardFocos = st.focos.filter(f => !f.archived);
  const isPristine = boardFocos.length === 0;
  const resetFocos = () => { setSt(s => ({ ...s, focos: s.focos.map(f => ({ ...f, active: false, archived: true })) })); pushToast({ kind: "info", icon: "refresh", title: "Workspace de foco limpo", msg: "Pesquisas e decisões foram mantidas." }); };

  /* ---- doc mutations ---- */
  const patchDoc = (id, partial) => setSt(s => ({ ...s, pesquisas: s.pesquisas.map(d => d.id === id ? { ...d, ...partial } : d) }));
  const saveDecision = (dec) => setSt(s => {
    const exists = s.decisoes.some(d => d.id === dec.id);
    const decisoes = exists ? s.decisoes.map(d => d.id === dec.id ? dec : d) : [dec, ...s.decisoes];
    const pesquisas = s.pesquisas.map(doc => (dec.from || []).includes(doc.id) && !doc.decisions.includes(dec.id) ? { ...doc, decisions: [...doc.decisions, dec.id] } : doc);
    return { ...s, decisoes, pesquisas };
  });
  const onSaveDecision = (dec) => { saveDecision(dec); pushToast({ kind: "success", icon: "checkcircle", title: decisionsById[dec.id] ? "Decisão atualizada" : "Decisão registrada", msg: dec.statement }); };
  const makeDecisionFromTakeaway = (doc, takeaway) => { setOpenDocId(null); setDrawer({ kind: "decision", initial: { statement: takeaway, tema: doc.tema, horizon: "agora", status: "testando", from: [doc.id], drives: [] } }); pushToast({ kind: "info", icon: "sparkles", title: "Takeaway → decisão", msg: "Revise e salve." }); };

  /* ---- focus mutations ---- */
  const saveFoco = (foco) => setSt(s => {
    const exists = s.focos.some(f => f.id === foco.id);
    let focos = exists ? s.focos.map(f => f.id === foco.id ? foco : f) : [...s.focos, foco];
    if (foco.active) focos = focos.map(f => f.id === foco.id ? f : (f.horizon === "agora" && f.active ? { ...f, active: false, state: "rascunho", horizon: "proximo" } : f));
    return { ...s, focos };
  });
  const onSaveFoco = (foco) => { saveFoco(foco); pushToast({ kind: foco.archived ? "info" : "success", icon: foco.archived ? "archive" : (foco.active ? "target" : "check"), title: foco.archived ? "Aposta arquivada" : foco.active ? "Foco do trimestre definido" : "Aposta salva", msg: foco.title }); };
  const onActivateFoco = (foco) => { onSaveFoco({ ...foco, active: true, state: "ativo", horizon: "agora" }); };
  const confirmFoco = (foco) => onActivateFoco(foco);
  const proposeFoco = (horizon = "proximo") => {
    const base = st.pesquisas.filter(d => d.status !== "arquivada").slice(0, 2).map(d => d.id);
    const foco = { id: "f-" + Date.now(), horizon, state: "proposto", author: "cowork", created: "agora",
      title: "Proposta: aprofundar IA como método visível",
      window: "a definir",
      thesis: "Com base nas suas pesquisas recentes, o Cowork sugere transformar o pilar IA em série prática — mostrando a IA construir junto, em público. Revise, ajuste e confirme para virar foco.",
      temas: ["ia", "dev"], metric: "Proposta — aguardando sua confirmação", basedOn: base };
    setSt(s => ({ ...s, focos: [...s.focos, foco] }));
    pushToast({ kind: "info", icon: "sparkles", title: "Cowork propôs um foco", msg: "Revise e confirme no board." });
  };

  const openDoc = (doc, mode = "read") => { setDocStartMode(mode); setOpenDocId(typeof doc === "string" ? doc : doc.id); document.querySelector(".content")?.scrollTo(0, 0); };
  const newPesquisa = () => {
    const id = "r-" + Date.now();
    const doc = { id, tema: activeTema === "all" ? "asia" : activeTema, status: "fresca", source: "thiago",
      title: "Nova pesquisa", summary: "Um resumo de uma linha aparece aqui.", updated: "agora", readMin: 1, pinned: false,
      takeaways: [], decisions: [], html: "<p></p>" };
    setSt(s => ({ ...s, pesquisas: [doc, ...s.pesquisas] }));
    openDoc(doc, "edit");
  };

  /* ---- DOCUMENT VIEW takes over ---- */
  if (openDocId) {
    const doc = docsById[openDocId];
    if (doc) return (
      <ResearchDoc doc={doc} decisionsById={decisionsById} key={doc.id} startMode={docStartMode}
        onBack={() => { setOpenDocId(null); setTab("pesquisas"); }}
        onChange={(html) => patchDoc(doc.id, { html, source: "thiago", updated: "agora" })}
        onPatch={(p) => patchDoc(doc.id, p)}
        onMakeDecision={makeDecisionFromTakeaway}
        onOpenDecision={(d) => { setOpenDocId(null); if (d && d.id) { setOpenDecisionId(d.id); } else { setTab("decisoes"); } }} />
    );
  }

  /* ---- DECISION VIEW takes over ---- */
  if (openDecisionId) {
    const dec = decisionsById[openDecisionId];
    if (dec) return (
      <DecisionDoc dec={dec} key={dec.id} docsById={docsById}
        onBack={() => { setOpenDecisionId(null); setTab("decisoes"); }}
        onEdit={(d) => { setOpenDecisionId(null); setDrawer({ kind: "decision", initial: d }); }}
        onPatch={(p) => setSt(s => ({ ...s, decisoes: s.decisoes.map(x => x.id === dec.id ? { ...x, ...p } : x) }))}
        onOpenDoc={(doc) => { setOpenDecisionId(null); openDoc(doc); }} />
    );
  }

  /* ---- filtered pesquisas ---- */
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const nq = norm(q);
  const pesquisasFiltered = st.pesquisas.filter(d =>
    (activeTema === "all" || d.tema === activeTema) &&
    (statusFilter === "all" || d.status === statusFilter) &&
    (!nq || norm(d.title + " " + d.summary).includes(nq))
  );

  const TABS = [["foco", "Foco", "target"], ["pesquisas", "Pesquisas", "research"], ["decisoes", "Decisões", "checkcheck"]];
  const agoraDecisions = st.decisoes.filter(d => d.horizon === "agora" && d.status !== "arquivado");
  const pinnedDocs = st.pesquisas.filter(d => d.pinned && d.status !== "arquivada");
  const decisoesFiltered = st.decisoes.filter(d => hzFilter === "all" ? true : d.horizon === hzFilter);
  const basedOnDocs = activeFoco ? (activeFoco.basedOn || []).map(id => docsById[id]).filter(Boolean) : [];
  const focoDecisionCount = activeFoco ? st.decisoes.filter(d => d.horizon === "agora" && d.status !== "arquivado").length : 0;

  return (
    <div>
      <div className="mod-head">
        <span className="mod-title">Research</span>
        <span className="mod-live"><i /> Cowork + você</span>
        <div className="grow" style={{ flex: 1 }} />
        {tab === "foco" && !isPristine && <button className="btn" onClick={() => setExplain(e => !e)}><Icon name="info" size={15} /> Como funciona</button>}
        {tab === "foco" && !isPristine && <button className="btn primary" onClick={() => setDrawer({ kind: "focus", initial: { horizon: "agora" } })}><Icon name="plus" size={15} /> Definir foco</button>}
        {tab === "pesquisas" && <button className="btn primary" onClick={newPesquisa}><Icon name="plus" size={15} /> Nova pesquisa</button>}
        {tab === "decisoes" && <button className="btn primary" onClick={() => setDrawer({ kind: "decision", initial: {} })}><Icon name="plus" size={15} /> Nova decisão</button>}
      </div>

      <div className="tabs">
        {TABS.map(([id, l, ic]) => (
          <button key={id} className={"tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
            <span className="row gap-6"><Icon name={ic} size={14} /> {l}</span>
          </button>
        ))}
      </div>

      {/* ============ FOCO ============ */}
      {tab === "foco" && (
        <div className="fade-in">
          {isPristine ? (
            <FocusZeroState
              pesquisasCount={st.pesquisas.filter(d => d.status !== "arquivada").length}
              onPropose={() => proposeFoco("agora")}
              onCreate={() => setDrawer({ kind: "focus", initial: { horizon: "agora" } })}
              onNewPesquisa={() => setTab("pesquisas")} />
          ) : (
            <React.Fragment>
              {explain && <ExplainerStrip onClose={dismissExplain} onPropose={() => proposeFoco(activeFoco ? "proximo" : "agora")} />}

              {activeFoco
                ? <FocusHero foco={activeFoco} basedOnDocs={basedOnDocs} decisionsCount={focoDecisionCount} onEdit={(f) => setDrawer({ kind: "focus", initial: f })} onOpenDoc={openDoc} />
                : <div className="fz-noactive">
                    <span className="fzn-ic"><Icon name="target" size={16} /></span>
                    <div className="fzn-tx"><b>Nenhum foco no ar.</b> Confirme uma aposta do board abaixo ou defina um novo foco.</div>
                    <button className="btn sm primary" onClick={() => setDrawer({ kind: "focus", initial: { horizon: "agora" } })}><Icon name="plus" size={14} /> Definir foco</button>
                  </div>}

              <div className="row between sec-head">
                <span className="section-label row gap-8"><Icon name="layers" size={13} /> Horizonte estratégico</span>
                <ResetFocosButton onReset={resetFocos} />
              </div>
              <HorizonBoard focos={boardFocos} onEdit={(f) => setDrawer({ kind: "focus", initial: f })} onConfirm={confirmFoco} onAdd={(h) => setDrawer({ kind: "focus", initial: { horizon: h } })} />

              <div className="foco-split">
                <div>
                  <div className="row between sec-head">
                    <span className="section-label row gap-8"><Icon name="target" size={13} /> Decisões em vigor</span>
                    <button className="card-link" onClick={() => setTab("decisoes")}>Todas <Icon name="arrowright" size={13} /></button>
                  </div>
                  <div className="col gap-10">
                    {agoraDecisions.map(d => <DecisionCard key={d.id} d={d} onEdit={(dd) => setDrawer({ kind: "decision", initial: dd })} onOpen={(dd) => setOpenDecisionId(dd.id)} onOpenDoc={openDoc} />)}
                    {agoraDecisions.length === 0 && <Card className="card-pad"><EmptyState icon="target" title="Nenhuma decisão para o foco atual" sub="Transforme um takeaway de pesquisa em decisão." /></Card>}
                  </div>
                </div>
                <div>
                  <div className="row between sec-head">
                    <span className="section-label row gap-8"><Icon name="pin" size={13} /> Pesquisa que sustenta o foco</span>
                    <button className="card-link" onClick={() => setTab("pesquisas")}>Biblioteca <Icon name="arrowright" size={13} /></button>
                  </div>
                  <div className="col gap-10">
                    {pinnedDocs.map(d => <ResearchCard key={d.id} doc={d} onOpen={openDoc} />)}
                    {pinnedDocs.length === 0 && <Card className="card-pad"><EmptyState icon="research" title="Nada fixado no foco" sub="Fixe pesquisas para mantê-las à mão." /></Card>}
                  </div>
                </div>
              </div>
            </React.Fragment>
          )}
        </div>
      )}

      {/* ============ PESQUISAS ============ */}
      {tab === "pesquisas" && (
        <div className="fade-in">
          <div className="cat-rail">
            <button className={"cat-chip" + (activeTema === "all" ? " on" : "")} onClick={() => setActiveTema("all")}>Todas <span className="ccount">{st.pesquisas.length}</span></button>
            {window.RESEARCH.TEMAS.map(t => {
              const count = st.pesquisas.filter(d => d.tema === t.id).length;
              return (
                <button key={t.id} className={"cat-chip" + (activeTema === t.id ? " on" : "")} onClick={() => setActiveTema(t.id)}>
                  <span className="cdot" style={{ background: t.color }} />{t.label}{count > 0 && <span className="ccount">{count}</span>}
                </button>
              );
            })}
          </div>
          <div className="row between" style={{ marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
            <div className="search-box" style={{ maxWidth: 320 }}><Icon name="search" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar pesquisas…" /></div>
            <div className="row gap-6">
              {STATUS_FILTERS.map(([k, l]) => <button key={k} className={"chip sm" + (statusFilter === k ? " on" : "")} onClick={() => setStatusFilter(k)}>{l}</button>)}
            </div>
          </div>
          {pesquisasFiltered.length === 0
            ? <Card className="card-pad" style={{ minHeight: 180 }}><EmptyState icon="research" title="Nenhuma pesquisa aqui" sub="Ajuste os filtros ou peça uma pesquisa nova ao Claude Cowork." action={<button className="btn primary sm mt-8" onClick={newPesquisa}><Icon name="plus" size={14} /> Nova pesquisa</button>} /></Card>
            : <div className="rgrid">{pesquisasFiltered.map(d => <ResearchCard key={d.id} doc={d} onOpen={openDoc} />)}</div>}
        </div>
      )}

      {/* ============ DECISÕES ============ */}
      {tab === "decisoes" && (
        <div className="fade-in">
          <div className="row gap-6" style={{ marginBottom: 18, flexWrap: "wrap" }}>
            <button className={"chip sm" + (hzFilter === "all" ? " on" : "")} onClick={() => setHzFilter("all")}>Todos os horizontes</button>
            {window.RESEARCH.HORIZONS.map(h => <button key={h.id} className={"chip sm" + (hzFilter === h.id ? " on" : "")} onClick={() => setHzFilter(h.id)}>{h.label}</button>)}
          </div>
          {window.RESEARCH.HORIZONS.filter(h => hzFilter === "all" || h.id === hzFilter).map(h => {
            const items = decisoesFiltered.filter(d => d.horizon === h.id);
            if (items.length === 0) return null;
            return (
              <div key={h.id} className="dec-group">
                <div className="dec-group-head"><Icon name={h.icon} size={14} style={{ color: h.color }} /><span>{h.label}</span><span className="dim fs12">· {h.sub}</span><span className="dec-count">{items.length}</span></div>
                <div className="dec-list">{items.map(d => <DecisionCard key={d.id} d={d} onEdit={(dd) => setDrawer({ kind: "decision", initial: dd })} onOpen={(dd) => setOpenDecisionId(dd.id)} onOpenDoc={openDoc} />)}</div>
              </div>
            );
          })}
          {decisoesFiltered.length === 0 && <Card className="card-pad" style={{ minHeight: 160 }}><EmptyState icon="target" title="Nenhuma decisão neste horizonte" sub="Registre uma decisão ou transforme um takeaway de pesquisa." /></Card>}
        </div>
      )}

      {drawer && drawer.kind === "decision" && <DecisionDrawer initial={drawer.initial} pesquisas={st.pesquisas} onClose={() => setDrawer(null)} onSave={onSaveDecision} />}
      {drawer && drawer.kind === "focus" && <FocusDrawer initial={drawer.initial} pesquisas={st.pesquisas} onClose={() => setDrawer(null)} onSave={onSaveFoco} onActivate={onActivateFoco} />}
    </div>
  );
}

Object.assign(window, { ResearchView });
