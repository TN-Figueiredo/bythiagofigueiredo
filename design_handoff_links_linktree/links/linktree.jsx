/* ============================================================
   links/linktree.jsx — preview público + editor da árvore
   ============================================================ */

function TFStamp({ size = 56 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", border: "1.5px solid #E0651E", display: "flex", alignItems: "center", justifyContent: "center", color: "#ECE6DA", fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: size * 0.34, flexShrink: 0 }}>
      <span>T<span style={{ fontStyle: "italic" }}>F</span></span>
    </div>
  );
}

function TreeRow({ icon, iconColor, title, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(245,239,230,0.08)", borderRadius: 11 }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: (iconColor || "#E0574E") + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={icon} size={16} style={{ color: iconColor || "#E0574E" }} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 14.5, fontWeight: 600, color: "#ECE6DA" }}>{title}</div>
        {sub && <div className="mono" style={{ fontSize: 10, color: "#A39C8E", marginTop: 1 }}>{sub}</div>}
      </div>
      <Icon name="chevronRight" size={15} style={{ color: "#6E685D" }} />
    </div>
  );
}

/* preview público (compacto) */
function LinktreePreview({ width = 300, tagline = "código, produto & vida indie", taglineEn = "code, product & indie life", shared = [] }) {
  return (
    <div style={{ width, background: "#13110d", border: "1px solid rgba(245,239,230,0.1)", borderRadius: 16, padding: "22px 18px", display: "flex", flexDirection: "column", gap: 14, fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 2 }}>
        {["PT", "EN"].map((l) => <span key={l} className="mono" style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 99, border: "1px solid rgba(245,239,230,0.15)", color: l === "EN" ? "#F2683C" : "#A39C8E" }}>{l}</span>)}
      </div>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <TFStamp size={54} />
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 600, color: "#ECE6DA", marginTop: 2 }}>Thiago Figueiredo</div>
        <div className="mono" style={{ fontSize: 10.5, color: "#A39C8E", letterSpacing: "0.04em" }}>{tagline}</div>
      </div>
      {/* latest card */}
      <div style={{ border: "1px solid rgba(245,239,230,0.1)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 13px", borderLeft: "2px solid #F2683C" }}>
          <div className="mono" style={{ fontSize: 8.5, letterSpacing: "0.16em", color: "#F2683C", marginBottom: 3 }}>ÚLTIMO POST</div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 13, fontWeight: 600, color: "#ECE6DA", lineHeight: 1.25 }}>I Learned a Language by Arguing with Strangers Online</div>
        </div>
      </div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: "0.16em", color: "#6E685D", marginTop: 2 }}>ENGLISH</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <TreeRow icon="blog" iconColor="#46B17E" title="Blog" sub="code, product & indie life" />
        <TreeRow icon="mail" iconColor="#E0A23C" title="Thiago's Journal" sub="Newsletter Weekly" />
        <TreeRow icon="youtube" title="YouTube" sub="@bythiagofigueiredo" />
      </div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: "0.16em", color: "#6E685D", marginTop: 4 }}>PORTUGUÊS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <TreeRow icon="blog" iconColor="#46B17E" title="Blog" sub="código, produto e vida indie" />
        <TreeRow icon="mail" iconColor="#E0A23C" title="Diário do Thiago" sub="Newsletter Semanal" />
      </div>
      {shared.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {shared.map((s) => <TreeRow key={s.id} icon={s.icon} iconColor="#8A8F98" title={s.labelPt} />)}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8, color: "#6E685D" }}>
        {["youtube", "youtube", "media", "posts"].map((ic, i) => <Icon key={i} name={ic} size={16} />)}
      </div>
    </div>
  );
}

/* ---------- editor ---------- */
function FieldRow({ label, lang, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
        {lang && <span className="mono" style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: lang === "EN" ? "var(--green-soft)" : "var(--accent-soft)", color: lang === "EN" ? "var(--green)" : "var(--accent)" }}>{lang}</span>}
      </div>
      {children}
    </div>
  );
}
const ltInput = { width: "100%", background: "var(--surface)", border: "1px solid var(--line-strong)", borderRadius: 9, padding: "10px 12px", color: "var(--ink)", fontSize: 13 };

function LinktreeEditor({ onClose }) {
  const D = window.LINKS_DATA.linktree;
  const [shared, setShared] = useState(D.sharedLinks);
  const [highlight, setHighlight] = useState(false);
  const [iconPickFor, setIconPickFor] = useState(null);
  const [tagPt, setTagPt] = useState("código, produto & vida indie");
  const [tagEn, setTagEn] = useState("code, product & indie life");
  const ICONS = ["links", "authors", "contacts", "mail", "blog", "youtube", "posts", "media", "courses", "megaphone", "pin", "globe", "heart", "bolt", "playlist", "audio"];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* toolbar */}
      <div style={{ height: 56, flexShrink: 0, borderBottom: "1px solid var(--line)", background: "var(--bg-side)", display: "flex", alignItems: "center", padding: "0 24px", gap: 14 }}>
        <Breadcrumb items={[{ label: "Links", icon: "links", onClick: onClose }, { label: "Linktree", onClick: onClose }, { label: "Editar" }]} />
        <Badge tone="amber" style={{ marginLeft: 4 }}>porta de entrada</Badge>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-dim)", marginLeft: 4 }}>go.bythiagofigueiredo.com</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <Btn kind="ghost" size="sm" onClick={onClose}>Cancelar</Btn>
          <Btn kind="primary" size="sm" icon="check" onClick={() => { window.__linksToast && window.__linksToast("Linktree salva"); onClose(); }}>Salvar</Btn>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* form */}
        <div style={{ flex: 1, overflowY: "auto", padding: "26px 30px", maxWidth: 720 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Geral</div>
          <FieldRow label="Tagline" lang="PT"><input value={tagPt} onChange={(e) => setTagPt(e.target.value)} style={ltInput} /></FieldRow>
          <FieldRow label="Tagline" lang="EN"><input value={tagEn} onChange={(e) => setTagEn(e.target.value)} style={ltInput} /></FieldRow>
          <FieldRow label="Descrição do Blog" lang="PT"><textarea defaultValue="Artigos sobre código, produto e vida indie" style={{ ...ltInput, minHeight: 64, resize: "vertical" }} /></FieldRow>
          <FieldRow label="Descrição do Blog" lang="EN"><textarea defaultValue="Posts on code, product & indie life" style={{ ...ltInput, minHeight: 64, resize: "vertical" }} /></FieldRow>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", margin: "8px 0 18px" }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>Highlight Card</div><div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginTop: 2 }}>Destaca um lançamento no topo da árvore.</div></div>
            <Toggle on={highlight} onChange={setHighlight} />
          </div>

          <div className="eyebrow" style={{ marginBottom: 12 }}>Shared Links · {shared.length}/10</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {shared.map((s, i) => (
              <div key={s.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, background: "var(--surface-2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <Icon name="drag" size={15} style={{ color: "var(--ink-faint)", cursor: "grab" }} />
                  <div style={{ position: "relative" }}>
                    <Btn kind="ghost" size="sm" icon={s.icon} onClick={() => setIconPickFor(iconPickFor === s.id ? null : s.id)}>Trocar ícone</Btn>
                    {iconPickFor === s.id && (
                      <div className="fade-up" style={{ position: "absolute", top: "110%", left: 0, zIndex: 5, background: "var(--surface)", border: "1px solid var(--line-strong)", borderRadius: 10, padding: 10, display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5, width: 230, boxShadow: "var(--shadow)" }}>
                        {ICONS.map((ic) => (
                          <button key={ic} onClick={() => { setShared(shared.map((x) => x.id === s.id ? { ...x, icon: ic } : x)); setIconPickFor(null); }} style={{ width: 32, height: 32, borderRadius: 7, background: s.icon === ic ? "var(--accent-soft)" : "var(--surface-2)", border: s.icon === ic ? "1px solid var(--accent)" : "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon name={ic} size={15} /></button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShared(shared.filter((x) => x.id !== s.id))} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--ink-faint)" }}><Icon name="trash" size={15} /></button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div><div style={{ fontSize: 10.5, color: "var(--ink-dim)", marginBottom: 5 }}>Label <span className="mono" style={{ color: "var(--accent)" }}>PT</span></div><input defaultValue={s.labelPt} style={ltInput} /></div>
                  <div><div style={{ fontSize: 10.5, color: "var(--ink-dim)", marginBottom: 5 }}>Label <span className="mono" style={{ color: "var(--green)" }}>EN</span></div><input defaultValue={s.labelEn} style={ltInput} /></div>
                </div>
                <div><div style={{ fontSize: 10.5, color: "var(--ink-dim)", marginBottom: 5 }}>URL</div><input defaultValue={s.url} style={{ ...ltInput, fontFamily: "JetBrains Mono, monospace", fontSize: 12 }} /></div>
              </div>
            ))}
            <Btn kind="soft" icon="plus" onClick={() => setShared([...shared, { id: "s" + Date.now(), icon: "links", labelPt: "Novo link", labelEn: "New link", url: "/" }])} style={{ alignSelf: "flex-start" }}>Adicionar link</Btn>
          </div>
        </div>
        {/* preview */}
        <div style={{ width: 400, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--bg-side)", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 20px", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "stretch", marginBottom: 16 }}>
            <span className="eyebrow">Preview ao vivo</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}><Icon name="refresh" size={14} style={{ color: "var(--ink-faint)" }} /><Icon name="external" size={14} style={{ color: "var(--ink-faint)" }} /></div>
          </div>
          <LinktreePreview width={320} shared={shared} tagline={tagPt} taglineEn={tagEn} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LinktreePreview, LinktreeEditor, TFStamp });
