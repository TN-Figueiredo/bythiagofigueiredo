/* ============================================================
   WAITLISTS MODULE — CMS admin (English-first, per spec §6).
   Screens: list · create/edit drawer · detail (status strip +
   overview + signups) · CSV export dialog · broadcast (launch)
   confirmation dialog with type-the-slug guard.
   Data: window.WL. Reuses shell primitives (Icon, Card, Badge,
   EmptyState, Skel, pushToast).
   ============================================================ */

const WL_STATUS = {
  draft:     { label: "Draft",     cls: "wl-draft",     hint: "Private — not visible publicly." },
  open:      { label: "Open",      cls: "wl-open",      hint: "Accepting signups." },
  closed:    { label: "Closed",    cls: "wl-closed",    hint: "Public, signups rejected — still broadcastable." },
  launching: { label: "Launching", cls: "wl-launching", hint: "Broadcast in flight." },
  launched:  { label: "Launched",  cls: "wl-launched",  hint: "Terminal — the launch email was sent." },
  failed:    { label: "Failed",    cls: "wl-failed",    hint: "Operator-recoverable." },
};

const SOURCE_META = {
  landing: { label: "landing", icon: "globe" },
  embed:   { label: "embed",   icon: "linkbio" },
  post:    { label: "post",    icon: "blog" },
};
const SUPP_META = {
  unsubscribe: { label: "unsubscribe", icon: "belloff" },
  bounce:      { label: "bounce",      icon: "warn" },
  complaint:   { label: "complaint",   icon: "flame" },
};

function WlBadge({ status, lg }) {
  const m = WL_STATUS[status] || WL_STATUS.draft;
  return <span className={"wl-badge " + m.cls + (lg ? " lg" : "")}><span className="wl-dot" />{m.label}</span>;
}

function fmtCount(n) { return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n); }
function relHours(h) { if (h <= 0) return "agora"; if (h < 24) return h + "h"; const d = Math.floor(h / 24); return d + "d"; }
function campTitle(id) { const c = window.WL.campaigns.find(x => x.id === id); return c ? c.title : null; }

/* ============================================================
   CREATE / EDIT DRAWER
   ============================================================ */
function slugify(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function CampaignPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = value ? campTitle(value) : null;
  const list = window.WL.campaigns.filter(c => c.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="finput" style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        {cur ? <><Icon name="megaphone" size={14} style={{ color: "var(--c-social)" }} /><span className="grow">{cur}</span></>
             : <span className="grow dim">No linked campaign</span>}
        <Icon name="chevrond" size={14} style={{ color: "var(--text-dim)" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30, background: "var(--elev)", border: "1px solid var(--border-strong)", borderRadius: 12, boxShadow: "var(--shadow-pop)", overflow: "hidden" }}>
          <div className="search-box" style={{ margin: 8, height: 34 }}>
            <Icon name="search" size={14} /><input autoFocus placeholder="Search campaigns…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto", padding: "0 6px 6px" }}>
            <button type="button" className="cmdk-row" style={{ width: "100%" }} onClick={() => { onChange(null); setOpen(false); }}>
              <span className="cmdk-ico"><Icon name="x" size={14} /></span><span className="cmdk-lbl">None</span>
            </button>
            {list.map(c => (
              <button key={c.id} type="button" className={"cmdk-row" + (value === c.id ? " on" : "")} style={{ width: "100%" }} onClick={() => { onChange(c.id); setOpen(false); }}>
                <span className="cmdk-ico"><Icon name="megaphone" size={14} /></span><span className="cmdk-lbl">{c.title}</span>
              </button>
            ))}
            {list.length === 0 && <div className="cmdk-empty" style={{ padding: 16 }}>No campaign matches “{q}”.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function EditDrawer({ wl, onClose, onSave }) {
  const isNew = !wl;
  const introRef = useRef(null);
  const introInit = useRef(wl ? wl.intro : "");
  const [name, setName] = useState(wl ? wl.name : "");
  const [slug, setSlug] = useState(wl ? wl.slug : "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [desc, setDesc] = useState(wl ? wl.description : "");
  const [campaign, setCampaign] = useState(wl ? wl.campaign : null);
  const [senderName, setSenderName] = useState(wl ? wl.sender_name : "Thiago Figueiredo");
  const [senderEmail, setSenderEmail] = useState(wl ? wl.sender_email : "noreply@bythiagofigueiredo.com");
  const [replyTo, setReplyTo] = useState(wl ? wl.reply_to : "");
  const [showSlugErr, setShowSlugErr] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const onName = (v) => { setName(v); if (!slugTouched) setSlug(slugify(v)); };
  const others = window.WL.waitlists.filter(w => !wl || w.id !== wl.id);
  const slugTaken = others.some(w => w.slug === slug.trim());
  // demo: pre-trip the inline error when someone types this known-taken slug
  const liveSlugErr = (showSlugErr && slugTaken) || slug.trim() === "codigo-em-portugues" && (!wl || wl.slug !== "codigo-em-portugues");

  const senderDomainOk = /@bythiagofigueiredo\.com$/.test(senderEmail.trim());

  const save = () => {
    if (slugTaken) { setShowSlugErr(true); return; }
    const introVal = introRef.current ? introRef.current.textContent : introInit.current;
    onSave({ ...(wl || {}), name: name || "Untitled waitlist", slug, description: desc, intro: introVal, campaign, sender_name: senderName, sender_email: senderEmail, reply_to: replyTo });
  };

  return ReactDOM.createPortal((
    <React.Fragment>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <Icon name={isNew ? "plus" : "edit"} size={17} style={{ color: "var(--accent-text)" }} />
          <span className="dt">{isNew ? "New waitlist" : "Edit waitlist"}</span>
          <div className="grow" />
          <button className="icon-btn bare" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="drawer-body">
          <div className="fsection">Essentials</div>
          <div className="fgroup">
            <span className="flabel">Name</span>
            <input className="finput" value={name} onChange={e => onName(e.target.value)} placeholder="e.g. Nômade Dev · Turma 1" />
          </div>
          <div className="fgroup">
            <span className="flabel">Slug</span>
            <input className={"finput mono" + (liveSlugErr ? " err" : "")} value={slug}
              onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true); setShowSlugErr(false); }} placeholder="nomade-dev-turma-1" />
            {liveSlugErr
              ? <span className="wl-field-err"><Icon name="warn" size={13} /> This slug is already taken on this site.</span>
              : <span className="fhint">Public URL: <span className="mono">/waitlists/{slug || "slug"}</span> · auto-filled from name, editable.</span>}
          </div>
          <div className="fgroup">
            <span className="flabel">Description</span>
            <textarea className="finput" rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="One line on what's coming." style={{ resize: "vertical", lineHeight: 1.5 }} />
          </div>

          <div className="fsection">Intro · rich text</div>
          <div className="fgroup">
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
              <div style={{ display: "flex", gap: 2, padding: "6px 8px", borderBottom: "1px solid var(--border-soft)", background: "var(--surface-2)" }}>
                {[["bold", "B"], ["italic", "i"], ["link", "↗"]].map(([k, g]) => (
                  <span key={k} style={{ width: 28, height: 26, display: "grid", placeItems: "center", borderRadius: 6, color: "var(--text-dim)", fontWeight: 700, fontSize: 13, fontStyle: k === "italic" ? "italic" : "normal" }}>{g}</span>
                ))}
              </div>
              <div contentEditable suppressContentEditableWarning ref={introRef}
                dangerouslySetInnerHTML={{ __html: introInit.current }}
                style={{ padding: "12px 13px", minHeight: 64, fontSize: 14, lineHeight: 1.6, color: "var(--text)", outline: "none" }} />
            </div>
            <span className="fhint">Authored here, compiled + sanitized. Shown above the form on the public page.</span>
          </div>

          <div className="fsection">Link</div>
          <div className="fgroup">
            <span className="flabel">Linked campaign · optional</span>
            <CampaignPicker value={campaign} onChange={setCampaign} />
            <span className="fhint">First-party lead-magnet context only — never a third-party promo.</span>
          </div>

          <div className="fsection">Sender</div>
          <div className="fgroup">
            <span className="flabel">Sender name</span>
            <input className="finput" value={senderName} onChange={e => setSenderName(e.target.value)} />
          </div>
          <div className="fgroup">
            <span className="flabel">Sender email</span>
            <input className={"finput mono" + (senderEmail && !senderDomainOk ? " err" : "")} value={senderEmail} onChange={e => setSenderEmail(e.target.value)} />
            {senderEmail && !senderDomainOk
              ? <span className="wl-field-err"><Icon name="warn" size={13} /> Must be on a domain you own.</span>
              : <span className="fhint">Validated against your verified domains at save and again before send.</span>}
          </div>
          <div className="fgroup">
            <span className="flabel">Reply-to · optional</span>
            <input className="finput mono" value={replyTo} onChange={e => setReplyTo(e.target.value)} placeholder="thiago@bythiagofigueiredo.com" />
          </div>

          <div className="fsection">Consent the visitor sees</div>
          <div className="wl-consent-preview">
            <span className="box" />
            <span>Quero ser avisado(a) por email quando <b>{name || "{Produto}"}</b> for lançado. Posso cancelar quando quiser.</span>
          </div>
          <span className="fhint" style={{ marginTop: 8, display: "block" }}>Email + this single consent checkbox are the only fields collected. No name, no phone, no price.</span>
        </div>

        <div className="drawer-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}><Icon name="check" size={15} /> {isNew ? "Create waitlist" : "Save changes"}</button>
        </div>
      </div>
    </React.Fragment>
  ), document.body);
}

/* ============================================================
   BROADCAST (LAUNCH) CONFIRMATION DIALOG
   ============================================================ */
function BroadcastDialog({ wl, onClose, onLaunch }) {
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    if (inputRef.current) inputRef.current.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const recipients = wl.pending;
  const match = text.trim() === wl.slug;
  const zero = recipients === 0;
  const canLaunch = match && !zero;
  return ReactDOM.createPortal((
    <div className="wl-scrim" onClick={onClose}>
      <div className="wl-modal" role="dialog" aria-modal="true" aria-label={"Launch " + wl.name} onClick={e => e.stopPropagation()}>
        <div className="wl-modal-head">
          <div className="h-ico accent"><Icon name="megaphone" size={18} /></div>
          <div>
            <div className="wl-modal-title">Launch {wl.name}?</div>
            <div className="wl-modal-sub">This is the one-shot launch broadcast.</div>
          </div>
          <div className="grow" style={{ flex: 1 }} />
          <button className="icon-btn bare" onClick={onClose}><Icon name="x" size={15} /></button>
        </div>
        <div className="wl-modal-body">
          <div className="wl-warn">
            <Icon name="warn" size={16} />
            <span>This sends <b>one email to {recipients.toLocaleString("en-US")} recipient{recipients === 1 ? "" : "s"}</b> and <b>cannot be undone</b>. Open and click tracking are disabled for this send.</span>
          </div>

          <div className={"wl-recip-box" + (zero ? " zero" : "")}>
            <Icon name="user" size={20} style={{ color: zero ? "var(--text-faint)" : "var(--accent-text)" }} />
            <div>
              <div className="r-num">{recipients.toLocaleString("en-US")}</div>
              <div className="r-lbl">eligible recipients (pending, not anonymized)</div>
            </div>
            {!zero && <span className="r-live"><span className="d" /> live count</span>}
          </div>

          {zero ? (
            <div className="dim fs12" style={{ textAlign: "center", padding: "4px 0 2px" }}>No eligible recipients — nothing to send.</div>
          ) : (
            <div className="wl-confirm-field">
              <div className="wl-confirm-lbl">Type the waitlist slug <code>{wl.slug}</code> to enable launch.</div>
              <input ref={inputRef} className={"wl-confirm-input" + (match ? " match" : "")} value={text} onChange={e => setText(e.target.value)} placeholder={wl.slug} spellCheck={false} />
            </div>
          )}
          {!wl.campaign && !zero && (
            <div className="dim fs12" style={{ marginTop: 12, display: "flex", gap: 7, alignItems: "center" }}>
              <Icon name="info" size={13} style={{ color: "var(--warn)" }} /> No campaign linked — that's allowed, just confirming.
            </div>
          )}
        </div>
        <div className="wl-modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={!canLaunch}
            style={{ background: canLaunch ? "var(--accent)" : "var(--surface-2)", color: canLaunch ? "var(--on-accent)" : "var(--text-faint)", borderColor: "transparent", fontWeight: 600, opacity: canLaunch ? 1 : .6, cursor: canLaunch ? "pointer" : "not-allowed" }}
            onClick={() => canLaunch && onLaunch()}>
            <Icon name="megaphone" size={15} /> {zero ? "No eligible recipients" : "Launch now"}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ============================================================
   CSV EXPORT DIALOG
   ============================================================ */
function ExportDialog({ wl, onClose }) {
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [excludeSupp, setExcludeSupp] = useState(true);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const est = status === "all" ? (excludeSupp ? wl.pending : wl.signups) : status === "pending" ? wl.pending : wl.suppressed;
  return ReactDOM.createPortal((
    <div className="wl-scrim" onClick={onClose}>
      <div className="wl-modal" role="dialog" aria-modal="true" aria-label="Export signups" onClick={e => e.stopPropagation()}>
        <div className="wl-modal-head">
          <div className="h-ico accent"><Icon name="archive" size={17} /></div>
          <div>
            <div className="wl-modal-title">Export signups · CSV</div>
            <div className="wl-modal-sub">{wl.name}</div>
          </div>
          <div className="grow" style={{ flex: 1 }} />
          <button className="icon-btn bare" onClick={onClose}><Icon name="x" size={15} /></button>
        </div>
        <div className="wl-modal-body">
          <div className="fgroup">
            <span className="flabel">Status filter</span>
            <div className="seg" style={{ width: "100%" }}>
              {[["all", "All"], ["pending", "Pending"], ["suppressed", "Suppressed"]].map(([k, l]) => (
                <button key={k} className={status === k ? "on" : ""} style={{ flex: 1 }} onClick={() => setStatus(k)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="fgroup">
            <span className="flabel">Date range · optional</span>
            <div className="wl-daterange">
              <input type="date" className="finput mono" value={from} onChange={e => setFrom(e.target.value)} />
              <input type="date" className="finput mono" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
          <div className="wl-toggle-row" onClick={() => setExcludeSupp(v => !v)} style={{ cursor: "pointer" }}>
            <div>
              <div className="t-lbl">Exclude suppressed</div>
              <div className="t-sub">Leave out unsubscribed / bounced / complained rows.</div>
            </div>
            <div className={"wl-switch" + (excludeSupp ? " on" : "")} />
          </div>
          <div className="wl-export-cols">
            <span className="ec-lbl">Columns</span>
            email · status · suppression_reason · source · locale · created
            <div style={{ marginTop: 6, color: "var(--text-faint)" }}>Anonymized rows are always omitted.</div>
          </div>
        </div>
        <div className="wl-modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => { onClose(); pushToast({ kind: "success", icon: "check", title: "Export started", msg: `waitlist-${wl.slug}-2026-06-15.csv · ~${est.toLocaleString("en-US")} rows` }); }}>
            <Icon name="archive" size={15} /> Export {est.toLocaleString("en-US")} rows
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ============================================================
   EMBED DIALOG — copy the iframe snippet for this waitlist
   (ties the public embed surface back into the admin)
   ============================================================ */
function EmbedDialog({ wl, onClose }) {
  const [copied, setCopied] = useState(false);
  const [accentHex, setAccentHex] = useState("");
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const src = `https://bythiagofigueiredo.com/embed/waitlists/${wl.slug}` + (/^[0-9a-fA-F]{6}$/.test(accentHex) ? `?accent=${accentHex}` : "");
  const code = `<iframe src="${src}"\n        width="480" height="420" loading="lazy"\n        style="border:0;width:100%;max-width:480px"></iframe>`;
  const copy = () => { const fallback = () => { try { const ta = document.createElement("textarea"); ta.value = code; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); } catch (e) {} }; try { const p = navigator.clipboard && navigator.clipboard.writeText(code); if (p && p.catch) p.catch(fallback); else fallback(); } catch (e) { fallback(); } setCopied(true); setTimeout(() => setCopied(false), 1600); };
  return ReactDOM.createPortal((
    <div className="wl-scrim" onClick={onClose}>
      <div className="wl-modal" role="dialog" aria-modal="true" aria-label={"Embed " + wl.name} onClick={e => e.stopPropagation()}>
        <div className="wl-modal-head">
          <div className="h-ico accent"><Icon name="linkbio" size={17} /></div>
          <div>
            <div className="wl-modal-title">Embed this waitlist</div>
            <div className="wl-modal-sub">{wl.name}</div>
          </div>
          <div className="grow" style={{ flex: 1 }} />
          <button className="icon-btn bare" onClick={onClose}><Icon name="x" size={15} /></button>
        </div>
        <div className="wl-modal-body">
          <div className="dim fs12" style={{ marginBottom: 14, lineHeight: 1.5 }}>
            Drop this on any page. The block posts a <span className="mono" style={{ color: "var(--accent-text)" }}>waitlist:resize</span> message for auto-height, and signups land here tagged <span className="wl-src-pill" style={{ verticalAlign: "middle" }}><Icon name="linkbio" size={11} /> embed</span>.
          </div>
          <div className="fgroup" style={{ marginBottom: 14 }}>
            <span className="flabel">Accent · optional</span>
            <div className="row gap-8">
              <input className="finput mono" value={accentHex} onChange={e => setAccentHex(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))} placeholder="FF8240" style={{ maxWidth: 140 }} />
              <span className="wl-switch" style={{ background: /^[0-9a-fA-F]{6}$/.test(accentHex) ? ("#" + accentHex) : "var(--surface-2)", width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
              <span className="dim fs11">6-digit hex; validated before binding.</span>
            </div>
          </div>
          <div style={{ position: "relative", background: "#0b0c10", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7, color: "#cdd0da", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {code}
          </div>
        </div>
        <div className="wl-modal-foot">
          <button className="btn ghost" onClick={onClose}>Done</button>
          <button className="btn primary" onClick={copy}><Icon name={copied ? "check" : "layers"} size={15} /> {copied ? "Copied" : "Copy snippet"}</button>
          <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{copied ? "Embed snippet copied to clipboard" : ""}</span>
        </div>
      </div>
    </div>
  ), document.body);
}

window.WL_EditDrawer = EditDrawer;
window.WL_BroadcastDialog = BroadcastDialog;
window.WL_ExportDialog = ExportDialog;
window.WL_EmbedDialog = EmbedDialog;
Object.assign(window, { WL_STATUS, SOURCE_META, SUPP_META, WlBadge, fmtCount, relHours, campTitle });
