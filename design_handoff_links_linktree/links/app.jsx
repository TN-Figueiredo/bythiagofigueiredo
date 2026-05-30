/* ============================================================
   links/app.jsx — router + tweaks (Links Studio)
   ============================================================ */

function LToast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, []);
  return (
    <div className="fade-up" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: "var(--surface-3)", border: "1px solid var(--line-strong)", borderRadius: 10, padding: "12px 18px", fontSize: 13, color: "var(--ink)", boxShadow: "var(--shadow)", display: "flex", alignItems: "center", gap: 9 }}>
      <Icon name="check" size={16} style={{ color: "var(--green)" }} /> {msg}
    </div>
  );
}

function CreateLinkModal({ onClose, onCreate }) {
  const D = window.LINKS_DATA;
  const [dest, setDest] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("manual");
  const slug = "/" + Math.random().toString(36).slice(2, 9);
  const inp = { width: "100%", background: "var(--surface)", border: "1px solid var(--line-strong)", borderRadius: 9, padding: "11px 13px", color: "var(--ink)", fontSize: 13.5 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(6,5,4,0.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} className="fade-up" style={{ width: "min(520px,100%)", background: "var(--surface)", border: "1px solid var(--line-strong)", borderRadius: 16, boxShadow: "var(--shadow)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="serif" style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>Novo link rastreado</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--ink-dim)" }}><Icon name="close" size={19} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 7 }}>Destino (URL)</div>
            <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="https://bythiagofigueiredo.com/…" style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 7 }}>Título</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Lançamento do curso" style={inp} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 7 }}>Origem</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {D.SOURCES.slice(0, 4).map((s) => <button key={s.id} onClick={() => setSource(s.id)} style={{ padding: "6px 11px", borderRadius: 8, border: "1px solid " + (source === s.id ? s.color : "var(--line-strong)"), background: source === s.id ? s.color + "22" : "var(--surface-2)", color: source === s.id ? s.color : "var(--ink-dim)", fontSize: 12, fontWeight: 600 }}>{s.label}</button>)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 7 }}>Slug</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, ...inp, paddingRight: 8 }}>
                <span className="mono" style={{ fontSize: 13, color: "var(--accent)" }}>{slug}</span>
                <Icon name="refresh" size={13} style={{ marginLeft: "auto", color: "var(--ink-faint)" }} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 9, fontSize: 11.5, color: "var(--ink-dim)" }}>
            <Icon name="target" size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} /> Click IDs ligados · redirect 301 · QR gerado automaticamente.
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--bg-side)" }}>
          <Btn kind="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn kind="primary" icon="plus" onClick={() => onCreate({ title, dest, source, slug })} disabled={!dest}>Criar link</Btn>
        </div>
      </div>
    </div>
  );
}

function LinksApp() {
  const [route, setRoute] = useState("hub");      // hub | detail
  const [tab, setTab] = useState("tree");
  const [curLink, setCurLink] = useState(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const D = window.LINKS_DATA;

  useEffect(() => {
    window.__linksToast = (m) => setToast(m);
    window.__socialToast = window.__socialToast || ((m) => setToast(m));
    const onMsg = (e) => {
      const d = e.data || {};
      if (d.type === "__activate_edit_mode") setTweaksOpen(true);
      else if (d.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", onMsg);
    try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch {}
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const goHub = (t) => { setRoute("hub"); if (t) setTab(t); window.scrollTo(0, 0); };
  const openLink = (l) => { setCurLink(l); setRoute("detail"); window.scrollTo(0, 0); };
  const openQR = (l) => { setCurLink(l || D.LINKS[0]); setQrOpen(true); };

  return (
    <>
      <Frame activeId="links" hideIds={["linkbio"]} onHome={() => goHub("tree")}>
        {route === "hub" && <LinksHub tab={tab} setTab={setTab} onOpenLink={openLink} onEditTree={() => setTreeOpen(true)} onTreeAnalytics={() => goHub("analytics")} onOpenQR={openQR} onNewLink={() => setCreateOpen(true)} />}
        {route === "detail" && curLink && <LinkDetail link={curLink} onBack={() => goHub("links")} onOpenQR={() => openQR(curLink)} />}
      </Frame>

      {treeOpen && <LinktreeEditor onClose={() => setTreeOpen(false)} />}
      {qrOpen && (
        <CanvasEditor
          onClose={() => setQrOpen(false)}
          onUse={() => { setQrOpen(false); setToast("QR Card salvo no link"); }}
          initial={D.qrCardDesign()}
          templates={D.QR_TEMPLATES}
          title="QR Card"
          crumbItems={[{ label: "Links", icon: "links", onClick: () => setQrOpen(false) }, { label: curLink ? curLink.slug : "/" }, { label: "QR Card" }]}
        />
      )}
      {createOpen && <CreateLinkModal onClose={() => setCreateOpen(false)} onCreate={() => { setCreateOpen(false); setToast("Link criado · QR gerado"); goHub("links"); }} />}
      {toast && <LToast msg={toast} onDone={() => setToast(null)} />}

      {tweaksOpen && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 150, width: 262, background: "rgba(20,18,15,0.96)", backdropFilter: "blur(14px)", border: "1px solid var(--line-strong)", borderRadius: 14, padding: 16, boxShadow: "var(--shadow)" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Tweaks · navegar cenas</div>
          <LNavBtn icon="linkbio" label="Linktree (porta de entrada)" active={route === "hub" && tab === "tree"} onClick={() => goHub("tree")} />
          <LNavBtn icon="links" label="Short links (tabela)" active={route === "hub" && tab === "links"} onClick={() => goHub("links")} />
          <LNavBtn icon="analytics" label="Analytics (rico)" active={route === "hub" && tab === "analytics"} onClick={() => goHub("analytics")} />
          <div className="eyebrow" style={{ margin: "12px 0 8px", paddingTop: 12, borderTop: "1px solid var(--line)" }}>Detalhe / editores</div>
          <LNavBtn icon="target" label="Detalhe de um link" active={route === "detail"} onClick={() => openLink(D.LINKS[0])} />
          <LNavBtn icon="type" label="Editor da Linktree" active={treeOpen} onClick={() => setTreeOpen(true)} />
          <LNavBtn icon="qr" label="Editor de QR (canvas)" active={qrOpen} onClick={() => openQR(D.LINKS[0])} />
          <LNavBtn icon="plus" label="Criar link (modal)" active={createOpen} onClick={() => setCreateOpen(true)} />
        </div>
      )}
    </>
  );
}

function LNavBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, border: "none", marginBottom: 3, textAlign: "left", fontSize: 12.5, fontWeight: active ? 600 : 500, background: active ? "var(--accent-soft)" : "transparent", color: active ? "var(--accent)" : "var(--ink-dim)" }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--surface-2)"; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      <Icon name={icon} size={15} /> {label}
    </button>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<LinksApp />);
