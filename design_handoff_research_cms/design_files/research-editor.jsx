/* ============================================================
   RESEARCH — TipTap editor wrapper + Document view (read/edit)
   Real TipTap (esm.sh) mounted imperatively into React.
   Exposes window.TipTapEditor, window.ResearchDoc.
   ============================================================ */

/* ---- wait for the TipTap module (loaded as type=module in index.html) ---- */
function useTipTapStatus() {
  const [s, setS] = useState(() => window.TipTap ? "ready" : (window.__tiptapError ? "failed" : "loading"));
  useEffect(() => {
    if (s !== "loading") return;
    const check = () => { if (window.TipTap) { setS("ready"); return true; } if (window.__tiptapError) { setS("failed"); return true; } return false; };
    if (check()) return;
    const h = () => check();
    window.addEventListener("tiptap-ready", h);
    const t = setInterval(() => { if (check()) clearInterval(t); }, 150);
    const to = setTimeout(() => { if (!window.TipTap) setS("failed"); clearInterval(t); }, 12000);
    return () => { window.removeEventListener("tiptap-ready", h); clearInterval(t); clearTimeout(to); };
  }, []);
  return s;
}

const TT_TOOLS = [
  { cmd: "toggleBold", is: "bold", label: "B", title: "Negrito", strong: true },
  { cmd: "toggleItalic", is: "italic", label: "i", title: "Itálico", it: true },
  { cmd: "toggleUnderline", is: "underline", label: "U", title: "Sublinhado", ul: true },
  { cmd: "toggleHighlight", is: "highlight", icon: null, label: "✦", title: "Destaque laranja", hl: true },
  { sep: true },
  { cmd: "toggleHeading", arg: { level: 2 }, is: "heading", isArg: { level: 2 }, label: "H2", title: "Título" },
  { cmd: "toggleHeading", arg: { level: 3 }, is: "heading", isArg: { level: 3 }, label: "H3", title: "Subtítulo" },
  { cmd: "toggleBlockquote", is: "blockquote", icon: "quote", title: "Nota / citação" },
  { sep: true },
  { cmd: "toggleBulletList", is: "bulletList", icon: "list", title: "Lista" },
  { cmd: "toggleOrderedList", is: "orderedList", icon: "olist", title: "Lista numerada" },
  { cmd: "toggleTaskList", is: "taskList", icon: "check", title: "Checklist" },
  { cmd: "_link", is: "link", icon: "link", title: "Link" },
  { sep: true },
  { cmd: "undo", icon: "undo", title: "Desfazer", noActive: true },
  { cmd: "redo", icon: "redo", title: "Refazer", noActive: true },
];

const EXTRA_ICONS = {
  quote: <><path d="M10 11H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1zM10 11c0 4-1 5-3 6"/><path d="M19 11h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1zM19 11c0 4-1 5-3 6"/></>,
  list: <><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></>,
  olist: <><path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></>,
  undo: <><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></>,
  redo: <><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/></>,
};
function EIcon({ name, size = 15 }) {
  if (EXTRA_ICONS[name]) return <svg className="lucide" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{EXTRA_ICONS[name]}</svg>;
  return <Icon name={name} size={size} />;
}

function TipTapToolbar({ editor, tick }) {
  if (!editor) return null;
  const run = (t) => {
    if (t.cmd === "_link") {
      const prev = editor.getAttributes("link").href || "";
      const url = window.prompt("URL do link:", prev);
      if (url === null) return;
      if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      return;
    }
    const c = editor.chain().focus();
    if (t.arg) c[t.cmd](t.arg).run(); else c[t.cmd]().run();
  };
  const active = (t) => {
    if (t.noActive) return false;
    if (t.isArg) return editor.isActive(t.is, t.isArg);
    return t.is && editor.isActive(t.is);
  };
  return (
    <div className="tt-toolbar">
      {TT_TOOLS.map((t, i) => t.sep
        ? <span key={i} className="tt-sep" />
        : <button key={i} className={"tt-btn" + (active(t) ? " on" : "") + (t.hl ? " hl" : "")} title={t.title}
            onMouseDown={(e) => e.preventDefault()} onClick={() => run(t)}>
            {t.icon !== undefined || (!t.label)
              ? <EIcon name={t.icon} />
              : <span className={"tt-gl" + (t.strong ? " b" : "") + (t.it ? " i" : "") + (t.ul ? " u" : "")}>{t.label}</span>}
          </button>)}
    </div>
  );
}

function TipTapEditor({ html, editable, onChange, placeholder = "Escreva…", onEditorReady }) {
  const status = useTipTapStatus();
  const ready = status === "ready";
  const elRef = useRef(null);
  const edRef = useRef(null);
  const [tick, setTick] = useState(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!ready || !elRef.current) return;
    const T = window.TipTap;
    const editor = new T.Editor({
      element: elRef.current,
      editable,
      extensions: [
        T.StarterKit.configure({ heading: { levels: [2, 3] } }),
        T.Underline,
        T.Highlight,
        T.Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener", target: "_blank" } }),
        T.TaskList,
        T.TaskItem.configure({ nested: true }),
        T.Placeholder.configure({ placeholder }),
      ],
      content: html || "<p></p>",
      onUpdate: ({ editor }) => { if (editor.isEditable) onChangeRef.current && onChangeRef.current(editor.getHTML()); },
      onSelectionUpdate: () => setTick(t => t + 1),
      onTransaction: () => setTick(t => t + 1),
    });
    edRef.current = editor;
    onEditorReady && onEditorReady(editor);
    return () => { editor.destroy(); edRef.current = null; };
  }, [ready]);

  useEffect(() => { if (edRef.current) edRef.current.setEditable(editable); setTick(t => t + 1); }, [editable]);

  if (!ready) {
    if (status === "failed") {
      return (
        <div className="tt-wrap reading">
          <div className="tt-prose"><div className="ProseMirror" dangerouslySetInnerHTML={{ __html: html || "<p></p>" }} /></div>
          <div className="tt-fallback"><Icon name="info" size={13} /> Editor avançado indisponível agora — mostrando a leitura. Reconecte para editar.</div>
        </div>
      );
    }
    return (
      <div className="tt-loading">
        <div className="tt-spin" /><span>Carregando editor…</span>
      </div>
    );
  }
  return (
    <div className={"tt-wrap" + (editable ? " editing" : " reading")}>
      {editable && <TipTapToolbar editor={edRef.current} tick={tick} />}
      <div className="tt-prose" ref={elRef} />
    </div>
  );
}

/* ============================================================
   DOCUMENT VIEW — read/edit a research doc + inspector
   ============================================================ */
const R = () => window.RESEARCH;

function SourceTag({ source, size = "sm" }) {
  const s = R().SOURCE[source]; if (!s) return null;
  return <span className={"src-tag " + size} style={{ "--st": s.tone }}><Icon name={s.icon} size={size === "sm" ? 12 : 13} /> {s.label}</span>;
}

function ResearchDoc({ doc, onBack, onChange, onPatch, decisionsById, onMakeDecision, onOpenDecision, startMode }) {
  const tema = R().TEMAS.find(t => t.id === doc.tema);
  const st = R().STATUS[doc.status];
  const [mode, setMode] = useState(startMode || "read");

  const linked = (doc.decisions || []).map(id => decisionsById[id]).filter(Boolean);

  const useIn = (where) => pushToast({ kind: "success", icon: "check", title: "Enviado para " + where, msg: doc.title });

  return (
    <div className="doc-view fade-in">
      {/* top bar */}
      <div className="doc-bar">
        <button className="btn ghost sm" onClick={onBack}><Icon name="chevronl" size={15} /> Pesquisas</button>
        <span className="doc-bar-crumb"><span className="tdot" style={{ background: tema?.color }} />{tema?.label}</span>
        <div className="grow" style={{ flex: 1 }} />
        <SourceTag source={doc.source} />
        <div className="seg doc-mode">
          <button className={mode === "read" ? "on" : ""} onClick={() => setMode("read")}><Icon name="eye" size={14} /> Ler</button>
          <button className={mode === "edit" ? "on" : ""} onClick={() => setMode("edit")}><Icon name="edit" size={14} /> Editar</button>
        </div>
      </div>

      <div className="doc-grid">
        {/* main column */}
        <div className="doc-main">
          <div className="doc-head">
            <div className="doc-kicker"><span className="tdot" style={{ background: tema?.color }} /> {tema?.label}</div>
            <div className="doc-eyebrow">
              <span className={"badge " + (st.kind === "muted" ? "" : st.kind)}><span className="dot" style={{ background: st.dot }} />{st.label}</span>
              <span className="dim fs12 mono">{doc.readMin} min de leitura · {doc.updated}</span>
            </div>
            {mode === "edit"
              ? <h1 key={"te-" + doc.id} className="doc-title-h1 doc-title-edit" contentEditable suppressContentEditableWarning spellCheck={false}
                  onBlur={(e) => onPatch({ title: (e.currentTarget.textContent || "").trim() || doc.title })}>{doc.title}</h1>
              : <h1 className="doc-title-h1">{doc.title}</h1>}
            <p className="doc-summary">{doc.summary}</p>
          </div>
          <TipTapEditor html={doc.html} editable={mode === "edit"} onChange={onChange} placeholder="Continue a pesquisa…" />
          <div className="doc-endmark"><span /><Icon name="sparkles" size={13} /><span /></div>
        </div>

        {/* inspector */}
        <aside className="doc-insp">
          <div className="insp-block">
            <div className="insp-h"><Icon name="zap" size={13} /> Takeaways</div>
            <div className="col gap-8">
              {doc.takeaways.map((tk, i) => (
                <div key={i} className="takeaway">
                  <span className="tk-mark" />
                  <span className="tk-txt">{tk}</span>
                  <button className="tk-act" title="Virar decisão" onClick={() => onMakeDecision(doc, tk)}>
                    <Icon name="arrowright" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="insp-block">
            <div className="insp-h"><Icon name="target" size={13} /> Decisões ligadas</div>
            {linked.length === 0
              ? <div className="insp-empty">Nenhuma ainda. Transforme um takeaway em decisão.</div>
              : <div className="col gap-7">
                  {linked.map(d => {
                    const ds = R().DECISION_STATUS[d.status];
                    return (
                      <button key={d.id} className="insp-dec" onClick={() => onOpenDecision(d)}>
                        <Icon name={ds.icon} size={13} style={{ color: "var(--" + (ds.kind === "muted" ? "text-dim" : ds.kind) + ")", flexShrink: 0 }} />
                        <span className="truncate2">{d.statement}</span>
                      </button>
                    );
                  })}
                </div>}
          </div>

          <div className="insp-block">
            <div className="insp-h"><Icon name="edit" size={13} /> Status</div>
            <select className="finput sm" value={doc.status} onChange={e => onPatch({ status: e.target.value })}>
              {Object.entries(R().STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div className="insp-block">
            <div className="insp-h"><Icon name="arrowright" size={13} /> Usar em</div>
            <div className="col gap-7">
              {[["Roteiros", "blog"], ["Newsletter", "mail"], ["Script de vídeo", "video"]].map(([w, ic]) => (
                <button key={w} className="use-btn" onClick={() => useIn(w)}><Icon name={ic} size={14} /> {w} <Icon name="arrowright" size={13} className="use-arrow" /></button>
              ))}
            </div>
          </div>

          <div className="insp-foot">
            <Icon name={R().SOURCE[doc.source].icon} size={13} />
            <span>{doc.source === "thiago" ? "Você editou" : doc.source === "cowork" ? "Escrito pelo Claude Cowork" : "Cowork + você"} · {doc.updated}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
   DECISION DOC — fullscreen read view for a single decision.
   Mirrors ResearchDoc's shell (doc-view / doc-grid) but with a
   decision-flavored hero, context, consequences, and an
   inspector carrying status, metric, revisit, sources, history.
   ============================================================ */
function DecisionDoc({ dec, onBack, onEdit, onPatch, docsById, onOpenDoc }) {
  const R2 = window.RESEARCH;
  const tema = R2.TEMAS.find(t => t.id === dec.tema);
  const ds = R2.DECISION_STATUS[dec.status];
  const hz = R2.HORIZONS.find(h => h.id === dec.horizon);
  const tone = ds.kind === "muted" ? "var(--text-dim)" : "var(--" + ds.kind + ")";
  const sources = (dec.from || []).map(id => (docsById || {})[id]).filter(Boolean);

  return (
    <div className="doc-view dec-view fade-in">
      {/* top bar */}
      <div className="doc-bar">
        <button className="btn ghost sm" onClick={onBack}><Icon name="chevronl" size={15} /> Decisões</button>
        <span className="doc-bar-crumb"><Icon name={hz?.icon} size={13} style={{ color: hz?.color }} />{hz?.label}</span>
        <span className="doc-bar-crumb"><span className="tdot" style={{ background: tema?.color }} />{tema?.label}</span>
        <div className="grow" style={{ flex: 1 }} />
        <span className="dstat lg" style={{ "--ds": tone }}><Icon name={ds.icon} size={13} />{ds.label}</span>
        <button className="btn sm" onClick={() => onEdit(dec)}><Icon name="edit" size={14} /> Editar</button>
      </div>

      <div className="doc-grid">
        {/* main column */}
        <div className="doc-main">
          <div className="dec-hero">
            <div className="dec-eyebrow"><Icon name="checkcheck" size={14} /> Decisão · {hz?.label} <span className="dec-eyebrow-date mono">{dec.date}</span></div>
            <h1 className="dec-statement">{dec.statement}</h1>
            <p className="dec-rationale">{dec.rationale}</p>
          </div>

          {dec.context && (
            <section className="dec-section">
              <div className="dec-sec-h"><Icon name="info" size={14} /> Contexto</div>
              <p className="dec-prose">{dec.context}</p>
            </section>
          )}

          {(dec.consequences || []).length > 0 && (
            <section className="dec-section">
              <div className="dec-sec-h"><Icon name="zap" size={14} /> O que isso decide</div>
              <ul className="dec-conseq">
                {dec.consequences.map((c, i) => <li key={i}><span className="dc-mark" /><span>{c}</span></li>)}
              </ul>
            </section>
          )}

          <div className="doc-endmark"><span /><Icon name="checkcheck" size={13} /><span /></div>
        </div>

        {/* inspector */}
        <aside className="doc-insp">
          <div className="insp-block">
            <div className="insp-h"><Icon name="edit" size={13} /> Status</div>
            <div className="dec-status-pick">
              {Object.entries(R2.DECISION_STATUS).map(([k, v]) => {
                const t = v.kind === "muted" ? "var(--text-dim)" : "var(--" + v.kind + ")";
                return (
                  <button key={k} className={"dsp-opt" + (dec.status === k ? " on" : "")} style={{ "--ds": t }}
                    onClick={() => onPatch && onPatch({ status: k })}>
                    <Icon name={v.icon} size={13} /> {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          {dec.metric && (
            <div className="insp-block">
              <div className="insp-h"><Icon name="gauge" size={13} /> Métrica de sucesso</div>
              <div className="dec-metric">{dec.metric}</div>
            </div>
          )}

          {dec.revisit && (
            <div className="insp-block">
              <div className="insp-h"><Icon name="clock" size={13} /> Revisitar</div>
              <div className="dec-revisit"><Icon name="calendar" size={13} /> {dec.revisit}</div>
            </div>
          )}

          <div className="insp-block">
            <div className="insp-h"><Icon name="research" size={13} /> Pesquisa que fundamenta</div>
            {sources.length === 0
              ? <div className="insp-empty">Decisão sem pesquisa ligada.</div>
              : <div className="col gap-7">
                  {sources.map(doc => (
                    <button key={doc.id} className="insp-dec" onClick={() => onOpenDoc && onOpenDoc(doc)}>
                      <Icon name="research" size={13} style={{ color: "var(--c-courses)", flexShrink: 0 }} />
                      <span className="truncate2">{doc.title}</span>
                    </button>
                  ))}
                </div>}
          </div>

          {(dec.drives || []).length > 0 && (
            <div className="insp-block">
              <div className="insp-h"><Icon name="arrowright" size={13} /> Alimenta</div>
              <div className="dec-drives">
                {dec.drives.map(w => <span key={w} className="drive-chip"><Icon name="arrowright" size={11} />{w}</span>)}
              </div>
            </div>
          )}

          {(dec.history || []).length > 0 && (
            <div className="insp-block">
              <div className="insp-h"><Icon name="clock" size={13} /> Histórico</div>
              <div className="dec-timeline">
                {dec.history.map((h, i) => (
                  <div key={i} className="dtl-row">
                    <span className="dtl-dot" />
                    <div className="dtl-body">
                      <div className="dtl-head"><b>{h.label}</b><span className="mono">{h.date}</span></div>
                      {h.note && <div className="dtl-note">{h.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { TipTapEditor, TipTapToolbar, ResearchDoc, DecisionDoc, useTipTapStatus, SourceTag });
