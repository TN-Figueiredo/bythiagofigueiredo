/* ============================================================
   DRAFT EDITOR v4 — inspector. No more "Prontidão" meter or
   checklist (the stages are sequential, so a % was noise).
   Detalhes is now the top, primary card. Distribuição shows
   site status + social. Histórico + Arquivar at the bottom.
   ============================================================ */

function Accordion({ icon, title, right, defaultOpen, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="insp-card">
      <button className={"acc-head" + (open ? " open" : "")} onClick={() => setOpen(o => !o)}>
        <Icon name={icon} size={15} style={{ color: "var(--text-dim)" }} />
        <span className="ih">{title}</span>
        <div className="grow" style={{ flex: 1 }} />
        {right}
        <Icon name="chevrond" size={16} className="acc-chev" />
      </button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  );
}

function DraftInspector({ post, cats, cc, cat, lang, slug, slugTouched, setSlugManual, resyncSlug, sitePublished, publishedAt, updatedAt, dirty, onRepublish }) {
  const langLabel = lang === "pt" ? "PT" : "EN";
  const url = "bythiagofigueiredo.com/blog/" + lang + "/" + (slug || "—");

  const [plats, setPlats] = useState(sitePublished ? { instagram: true, bluesky: true } : {});
  const togglePlat = (k) => setPlats(p => ({ ...p, [k]: !p[k] }));
  const PLATFORMS = [["instagram", "Instagram"], ["bluesky", "Bluesky"], ["facebook", "Facebook"], ["youtube", "YouTube"]];

  return (
    <div className="insp v3">
      {/* DETALHES — primary */}
      <div className="insp-card">
        <div className="insp-head"><Icon name="layers" size={15} /><span className="ih">Detalhes</span><div className="grow" style={{ flex: 1 }} /><span className="dim fs11">Blog · {langLabel} · {post.plevel || "P3"}</span></div>
        <div className="insp-body">
          <div className="det-row">
            <span className="flabel">Endereço (slug)</span>
            <div className="slug-wrap">
              <span className="slug-pre">/blog/{lang}/</span>
              <input value={slug} onChange={e => setSlugManual(e.target.value)} placeholder="slug-do-post" spellCheck={false} />
            </div>
            <span className="fhint">{slugTouched
              ? <button className="linkbtn" onClick={resyncSlug}>↻ regenerar do título</button>
              : <>derivado do título · <span className="mono">auto</span></>}</span>
          </div>

          <div className="det-row">
            <span className="flabel">Categoria</span>
            <div className="tag-chips">
              {cat && <span className="preview-chip" style={{ color: cc, background: "color-mix(in srgb," + cc + " 14%,transparent)", borderColor: "transparent" }}><span className="cdot" style={{ width: 9, height: 9, borderRadius: 3, background: cc }} /> {cat.pt}</span>}
            </div>
          </div>

          <div className="det-row">
            <span className="flabel">Tags · {(post.tags || []).length}</span>
            <div className="tag-chips">
              {(post.tags || []).map(t => <span key={t} className="tag-chip">{t}</span>)}
              <button className="tag-add" onClick={() => pushToast({ kind: "info", icon: "plus", title: "Adicionar tag" })}><Icon name="plus" size={12} /> tag</button>
            </div>
          </div>
        </div>
      </div>

      {/* DISTRIBUIÇÃO */}
      <div className="insp-card">
        <div className="insp-head"><Icon name="globe" size={15} /><span className="ih">Distribuição</span></div>
        <div className="insp-body">
          <div className="pubsite">
            {sitePublished
              ? (dirty
                  ? <span className="ps-status pending"><Icon name="warn" size={14} /> Publicado · alterações pendentes</span>
                  : <span className="ps-status live"><Icon name="checkcircle" size={14} /> Publicado · no ar</span>)
              : <span className="ps-status draft"><Icon name="edit" size={14} /> Rascunho · não publicado</span>}
            <span className="ps-url">{url}</span>
            {sitePublished && (
              <div className="ps-dates">
                {publishedAt && <span>Publicado {publishedAt}</span>}
                {updatedAt && <span className="pd-upd">· atualizado {updatedAt}</span>}
              </div>
            )}
            {sitePublished && dirty && <button className="btn sm primary" style={{ width: "100%", marginTop: 8 }} onClick={onRepublish}><Icon name="refresh" size={13} /> Atualizar no site</button>}
          </div>
        </div>
        <Accordion icon="posts" title="Redes sociais" right={<span className={"tgl" + (Object.values(plats).some(Boolean) ? " on" : "")} onClick={(e) => { e.stopPropagation(); setPlats(Object.values(plats).some(Boolean) ? {} : { instagram: true, bluesky: true }); }} />} defaultOpen={false}>
          <div className="plat-grid">
            {PLATFORMS.map(([k, l]) => (
              <button key={k} className={"plat-check" + (plats[k] ? " on" : "")} onClick={() => togglePlat(k)}>
                <span className="pc-box">{plats[k] && <Icon name="check" size={11} />}</span>{l}
              </button>
            ))}
          </div>
          <div className="fgroup">
            <span className="flabel">Hashtags</span>
            <div className="hash-chips">{(post.tags || []).slice(0, 5).map(t => <span key={t} className="hash-chip">#{t.replace(/-/g, "")}</span>)}</div>
          </div>
        </Accordion>
      </div>

      {/* HISTÓRICO */}
      <Accordion icon="clock" title="Histórico" right={<span className="dim fs11" style={{ marginRight: 4 }}>{(post.history || []).length}</span>} defaultOpen={false}>
        {(post.history || []).map((h, i) => (
          <div key={i} className="hist-row"><span className="hr-dot" /><span className="hr-to">Etapa → <b>{h.to}</b></span><span className="hr-date">{h.date}</span></div>
        ))}
      </Accordion>

      <button className="btn" style={{ color: "var(--danger)", borderColor: "color-mix(in srgb,var(--danger) 30%,transparent)", background: "var(--danger-s)", width: "100%" }}
        onClick={() => pushToast({ kind: "warning", icon: "archive", title: "Arquivar post", msg: "Ação desabilitada no protótipo." })}>
        <Icon name="archive" size={15} /> Arquivar
      </button>
    </div>
  );
}

Object.assign(window, { DraftInspector, Accordion });
