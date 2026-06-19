/* ============================================================
   WAITLISTS MODULE — list + detail (status strip, overview,
   signups) + the WaitlistsView entry rendered by the shell.
   Loaded AFTER views-waitlists.jsx (which holds the dialogs).
   ============================================================ */

/* ---------------- LIST ---------------- */
function WaitlistsList({ items, onOpen, onNew, state }) {
  const total = items.reduce((a, w) => a + w.signups, 0);
  const openCount = items.filter(w => w.status === "open").length;
  const needsAttn = items.filter(w => w.status === "failed").length + items.filter(w => w.status === "launching").length;

  return (
    <div>
      <div className="mod-head">
        <span className="mod-title">Waitlists</span>
        <span className="mod-live"><i /> Updated now</span>
        <div className="grow" style={{ flex: 1 }} />
        <button className="btn primary" onClick={onNew}><Icon name="plus" size={15} /> New waitlist</button>
      </div>

      {state === "empty" ? (
        <Card className="card-pad" style={{ minHeight: 280 }}>
          <EmptyState icon="gift" title="No waitlists yet"
            sub="Create a waitlist so visitors can sign up to be emailed when a not-yet-released product launches."
            action={<button className="btn primary mt-8" onClick={onNew}><Icon name="plus" size={15} /> New waitlist</button>} />
        </Card>
      ) : state === "loading" ? (
        <React.Fragment>
          <div className="wl-kpis">{[0,1,2,3].map(i => <Card key={i} className="wl-kpi"><Skel h={64} /></Card>)}</div>
          <Card><div style={{ padding: 16 }}>{[0,1,2,3,4].map(i => <Skel key={i} h={44} style={{ marginBottom: 8 }} />)}</div></Card>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <div className="wl-kpis">
            <Card className="wl-kpi"><div className="k-lbl"><Icon name="gift" size={13} /> Waitlists</div><div className="k-val">{items.length}</div><div className="k-foot">{openCount} open · accepting</div></Card>
            <Card className="wl-kpi"><div className="k-lbl"><Icon name="user" size={13} /> Total signups</div><div className="k-val">{fmtCount(total)}</div><div className="k-foot">across all lists</div></Card>
            <Card className="wl-kpi"><div className="k-lbl"><Icon name="megaphone" size={13} /> Linked campaigns</div><div className="k-val">{items.filter(w => w.campaign).length}</div><div className="k-foot">first-party context</div></Card>
            <Card className="wl-kpi"><div className="k-lbl"><Icon name="zap" size={13} /> Needs attention</div><div className="k-val" style={{ color: needsAttn ? "var(--danger)" : "var(--text)" }}>{needsAttn}</div><div className="k-foot">failed or in-flight</div></Card>
          </div>

          <Card style={{ overflow: "hidden" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th><th>Status</th><th className="num">Signups</th><th>Linked campaign</th><th className="num">Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map(w => (
                  <tr key={w.id} className="wl-row-link" onClick={() => onOpen(w.id)}>
                    <td>
                      <div className="wl-name"><span className="nm">{w.name}</span><span className="sl">/waitlists/{w.slug}</span></div>
                    </td>
                    <td><WlBadge status={w.status} /></td>
                    <td className="num"><span className="wl-count">{w.signups.toLocaleString("en-US")}{w.suppressed > 0 && <span className="sub" title={w.suppressed + " suppressed (unsubscribed / bounced / complained)"}>−{w.suppressed}</span>}</span></td>
                    <td>{w.campaign
                      ? <span className="wl-camp"><Icon name="megaphone" size={13} /> {campTitle(w.campaign)}</span>
                      : <span className="wl-camp none">—</span>}</td>
                    <td className="num"><span className="dim mono fs12">{relHours(w.updated)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </React.Fragment>
      )}
    </div>
  );
}

/* ---------------- STATUS STRIP + BANNERS ---------------- */
function StatusStrip({ wl, onTransition, onBroadcast }) {
  const s = wl.status;
  const Btn = ({ disabled, cls, icon, children, onClick }) => (
    <button className={"wl-trans " + (cls || "")} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={14} /> {children}
    </button>
  );
  return (
    <div className="wl-strip">
      <span className="wl-strip-lbl">Status</span>
      {s === "draft" && <>
        <Btn icon="check" onClick={() => onTransition("open")}>Open</Btn>
        <span className="wl-strip-arrow"><Icon name="arrowright" size={13} /></span>
        <span className="wl-strip-note"><Icon name="eye" size={13} /> Private until you open it.</span>
      </>}
      {s === "open" && <>
        <Btn icon="pause" onClick={() => onTransition("closed")}>Close signups</Btn>
        <span className="wl-strip-arrow"><Icon name="arrowright" size={13} /></span>
        <Btn cls="launch" icon="megaphone" onClick={onBroadcast}>Launch…</Btn>
      </>}
      {s === "closed" && <>
        <Btn icon="refresh" onClick={() => onTransition("open")}>Reopen</Btn>
        <span className="wl-strip-arrow"><Icon name="arrowright" size={13} /></span>
        <Btn cls="launch" icon="megaphone" onClick={onBroadcast}>Launch…</Btn>
      </>}
      {s === "launching" && <>
        <Btn icon="check" disabled>Open</Btn>
        <Btn icon="pause" disabled>Close</Btn>
        <Btn cls="launch" icon="megaphone" disabled>Launching…</Btn>
      </>}
      {s === "launched" && <>
        <span className="wl-strip-note"><Icon name="checkcircle" size={14} style={{ color: "var(--c-newsletter)" }} /> Terminal — launched {wl.launched_at || ""}. No further transitions.</span>
      </>}
      {s === "failed" && <>
        <Btn cls="recover" icon="refresh" onClick={() => onTransition("closed")}>Resume / Retry</Btn>
        <span className="wl-strip-arrow"><Icon name="arrowright" size={13} /></span>
        <span className="wl-strip-note">Reverts to <b style={{ color: "var(--text)" }}>closed</b> so you can re-launch.</span>
      </>}
      <span className="wl-strip-spacer" />
      <span className="wl-strip-note">{WL_STATUS[s].hint}</span>
    </div>
  );
}

/* ---------------- OVERVIEW TAB ---------------- */
function OverviewTab({ wl, onBroadcast }) {
  const src = wl.sources || { landing: 0, embed: 0, post: 0 };
  const srcTotal = Math.max(1, src.landing + src.embed + src.post);
  const canBroadcast = wl.status === "open" || wl.status === "closed";
  return (
    <div className="fade-in wl-ov-grid">
      <div className="col gap-16">
        <Card>
          <CardHead icon="gift" title="What's coming" />
          <div className="card-pad">
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>{wl.description}</div>
            {wl.intro && <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-soft)" }}>{wl.intro}</div>}
          </div>
        </Card>

        <Card>
          <CardHead icon="trending" title="Signups by source" right={<span className="dim fs12 mono">{wl.signups.toLocaleString("en-US")} total</span>} />
          <div className="card-pad">
            <div className="wl-src">
              {["landing", "embed", "post"].map(k => (
                <div key={k} className="wl-src-row">
                  <span className="s-lbl"><Icon name={SOURCE_META[k].icon} size={13} /> {SOURCE_META[k].label}</span>
                  <span className="wl-src-bar"><span style={{ width: Math.round(src[k] / srcTotal * 100) + "%" }} /></span>
                  <span className="s-val">{src[k].toLocaleString("en-US")}</span>
                </div>
              ))}
            </div>
            <div className="row gap-16" style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-soft)", flexWrap: "wrap" }}>
              <div><div className="dim fs11" style={{ textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>Pending</div><div className="fw6" style={{ fontSize: 18, color: "var(--ok)" }}>{wl.pending.toLocaleString("en-US")}</div></div>
              <div><div className="dim fs11" style={{ textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>Suppressed</div><div className="fw6" style={{ fontSize: 18, color: "var(--text-dim)" }}>{wl.suppressed}</div></div>
            </div>
          </div>
        </Card>
      </div>

      <div className="col gap-16">
        {/* Broadcast / launch CTA */}
        {canBroadcast ? (
          <Card className="wl-broadcast-cta">
            <div className="row between" style={{ marginBottom: 14 }}>
              <span className="section-label">Launch broadcast</span>
              <Icon name="megaphone" size={16} style={{ color: "var(--accent-text)" }} />
            </div>
            <div className="bc-recip">{wl.pending.toLocaleString("en-US")}</div>
            <div className="bc-lbl">eligible recipients will get one email.</div>
            <button className="btn primary" style={{ width: "100%", marginTop: 16 }} onClick={onBroadcast} disabled={wl.pending === 0}>
              <Icon name="megaphone" size={15} /> Launch {wl.name.split(" · ")[0]}…
            </button>
            <div className="dim fs11 mt-8" style={{ textAlign: "center" }}>One-shot · cannot be undone · type-to-confirm.</div>
          </Card>
        ) : (
          <Card className="card-pad">
            <span className="section-label">Launch broadcast</span>
            <div className="dim fs13 mt-8" style={{ lineHeight: 1.5 }}>
              {wl.status === "draft" && "Open the waitlist before you can launch."}
              {wl.status === "launching" && "Broadcast is in flight — the launch email is sending now."}
              {wl.status === "launched" && `Sent ${wl.launched_at || ""}. This is terminal.`}
              {wl.status === "failed" && "The last broadcast failed. Resume/Retry to re-launch."}
            </div>
          </Card>
        )}

        <Card>
          <CardHead icon="info" title="Details" />
          <div className="card-pad col gap-12">
            <Meta label="Campaign" value={wl.campaign ? campTitle(wl.campaign) : "None"} icon="megaphone" dim={!wl.campaign} />
            <Meta label="Sender" value={wl.sender_email} icon="mail" mono />
            <Meta label="Reply-to" value={wl.reply_to || "—"} icon="arrowright" mono dim={!wl.reply_to} />
            <Meta label="Created" value={wl.created} icon="calendar" />
          </div>
        </Card>
      </div>
    </div>
  );
}
function Meta({ label, value, icon, mono, dim }) {
  return (
    <div className="row gap-12" style={{ alignItems: "flex-start" }}>
      <span className="dim fs12" style={{ width: 84, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name={icon} size={13} /> {label}</span>
      <span className={(mono ? "mono " : "") + "fs13"} style={{ color: dim ? "var(--text-faint)" : "var(--text)", wordBreak: "break-word", flex: 1 }}>{value}</span>
    </div>
  );
}

/* ---------------- SIGNUPS TAB ---------------- */
const PAGE_SIZE = 12;
function SignupsTab({ wl, onExport }) {
  const all = window.WL.signupsByList[wl.id] || [];
  const [statusF, setStatusF] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const filtered = all.filter(s =>
    (statusF === "all" || s.status === statusF) &&
    (!q || s.email.toLowerCase().startsWith(q.toLowerCase()))
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pg = Math.min(page, pages - 1);
  const slice = filtered.slice(pg * PAGE_SIZE, pg * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="fade-in">
      <div className="wl-filters">
        <div className="search-box" style={{ maxWidth: 280 }}>
          <Icon name="search" size={15} /><input placeholder="Search email (prefix)…" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} />
        </div>
        <div className="row gap-6">
          {[["all", "All"], ["pending", "Pending"], ["suppressed", "Suppressed"]].map(([k, l]) => (
            <button key={k} className={"chip sm" + (statusF === k ? " on" : "")} onClick={() => { setStatusF(k); setPage(0); }}>{l}</button>
          ))}
        </div>
        <span className="grow" />
        <button className="btn sm" onClick={onExport}><Icon name="archive" size={14} /> Export CSV</button>
      </div>

      <Card style={{ overflow: "hidden" }}>
        {slice.length === 0 ? (
          <EmptyState icon="user" title="No signups match" sub="Try a different status or email prefix." />
        ) : (
          <table className="data">
            <thead>
              <tr><th>Email</th><th>Status</th><th>Suppression</th><th>Source</th><th className="num">Created</th></tr>
            </thead>
            <tbody>
              {slice.map(s => (
                <tr key={s.id}>
                  <td><span className="mono fs13">{s.email}</span></td>
                  <td><span className={"wl-mini-status " + s.status}><span className="d" /> {s.status}</span></td>
                  <td>{s.suppression_reason
                    ? <span className={"wl-supp " + s.suppression_reason}><Icon name={SUPP_META[s.suppression_reason].icon} size={13} /> {SUPP_META[s.suppression_reason].label}</span>
                    : <span className="wl-supp none">—</span>}</td>
                  <td><span className="wl-src-pill"><Icon name={SOURCE_META[s.source].icon} size={11} /> {SOURCE_META[s.source].label}</span></td>
                  <td className="num"><span className="dim fs12">{s.created === 0 ? "today" : s.created + "d ago"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="wl-pager">
        <span className="pg-info">{filtered.length === 0 ? "0 results" : `${pg * PAGE_SIZE + 1}–${Math.min((pg + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}`}{statusF !== "all" || q ? " (filtered)" : ""}</span>
        <div className="row gap-8">
          <button className="btn sm" disabled={pg === 0} onClick={() => setPage(p => Math.max(0, p - 1))}><Icon name="chevronl" size={14} /> Prev</button>
          <button className="btn sm" disabled={pg >= pages - 1} onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>Next <Icon name="chevronr" size={14} /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- DETAIL ---------------- */
function WaitlistDetail({ wl, onBack, onTransition, onEdit, onBroadcast, onExport, onEmbed }) {
  const [tab, setTab] = useState("overview");
  return (
    <div className="fade-in">
      <button className="wl-back" onClick={onBack}><Icon name="chevronl" size={15} /> Waitlists</button>

      <div className="wl-dhead">
        <div className="grow">
          <div className="row gap-12" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <span className="wl-dtitle">{wl.name}</span>
            <WlBadge status={wl.status} lg />
          </div>
          <div className="wl-dslug"><span className="pre">bythiagofigueiredo.com/waitlists/</span><span className="sl">{wl.slug}</span></div>
        </div>
        <div className="row gap-8">
          <button className="btn" onClick={onEmbed}><Icon name="linkbio" size={15} /> Embed</button>
          <button className="btn" onClick={onEdit}><Icon name="edit" size={15} /> Edit</button>
        </div>
      </div>

      {/* status-specific banner */}
      {wl.status === "launching" && (
        <div className="wl-banner flight"><Icon name="megaphone" size={16} /><span className="grow">Broadcast in flight — sending one email to <b>{wl.pending.toLocaleString("en-US")}</b> recipients. The list flips to <b>launched</b> automatically when SES finishes.</span><span className="mono fs12 dim">sending…</span></div>
      )}
      {wl.status === "launched" && (
        <div className="wl-banner done"><Icon name="checkcircle" size={16} /><span className="grow">Launched on <b>{wl.launched_at}</b>. The launch email went to <b>{wl.pending.toLocaleString("en-US")}</b> recipients.</span></div>
      )}
      {wl.status === "failed" && (
        <div className="wl-banner fail"><Icon name="warn" size={16} /><span className="grow">The last broadcast <b>failed</b> before completing. Resume/Retry reverts to <b>closed</b> and deletes the failed edition so you can re-launch.</span></div>
      )}

      <StatusStrip wl={wl} onTransition={onTransition} onBroadcast={onBroadcast} />

      <div className="tabs">
        {[["overview", "Overview", "dashboard"], ["signups", "Signups", "user"]].map(([id, l, ic]) => (
          <button key={id} className={"tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
            <span className="row gap-6"><Icon name={ic} size={14} /> {l}{id === "signups" && <span className="dim" style={{ fontVariantNumeric: "tabular-nums" }}>· {wl.signups.toLocaleString("en-US")}</span>}</span>
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab wl={wl} onBroadcast={onBroadcast} />}
      {tab === "signups" && <SignupsTab wl={wl} onExport={onExport} />}
    </div>
  );
}

/* ---------------- ENTRY ---------------- */
function WaitlistsView({ go, state }) {
  const [items, setItems] = useState(window.WL.waitlists);
  const [openId, setOpenId] = useState(null);
  const [drawer, setDrawer] = useState(null);      // { wl } | { wl: null } for new
  const [dialog, setDialog] = useState(null);      // { kind: "broadcast"|"export", wl }

  const current = openId ? items.find(w => w.id === openId) : null;

  const transition = (next) => {
    if (!current) return;
    setItems(list => list.map(w => w.id === current.id ? { ...w, status: next, updated: 0 } : w));
    const labels = { open: "opened", closed: "closed", launched: "launched" };
    pushToast({ kind: next === "closed" ? "info" : "success", icon: next === "closed" ? "pause" : "checkcircle", title: `Waitlist ${labels[next] || "updated"}`, msg: current.name });
  };
  const doLaunch = () => {
    if (!current) return;
    setItems(list => list.map(w => w.id === current.id ? { ...w, status: "launching", updated: 0 } : w));
    setDialog(null);
    pushToast({ kind: "warning", icon: "megaphone", title: "Launching…", msg: `Sending to ${current.pending.toLocaleString("en-US")} recipients. This can't be undone.` });
  };
  const saveWaitlist = (data) => {
    if (data.id) setItems(list => list.map(w => w.id === data.id ? { ...w, ...data, updated: 0 } : w));
    else {
      const nw = { ...data, id: "wl-" + Date.now(), status: "draft", signups: 0, pending: 0, suppressed: 0, updated: 0, created: "15 jun 2026", sources: { landing: 0, embed: 0, post: 0 } };
      setItems(list => [nw, ...list]);
      window.WL.signupsByList[nw.id] = [];
    }
    setDrawer(null);
    pushToast({ kind: "success", icon: "check", title: data.id ? "Waitlist saved" : "Waitlist created", msg: data.name });
  };

  return (
    <div>
      {current
        ? <WaitlistDetail wl={current} onBack={() => setOpenId(null)}
            onTransition={transition} onEdit={() => setDrawer({ wl: current })}
            onBroadcast={() => setDialog({ kind: "broadcast", wl: current })}
            onExport={() => setDialog({ kind: "export", wl: current })}
            onEmbed={() => setDialog({ kind: "embed", wl: current })} />
        : <WaitlistsList items={items} state={state} onOpen={setOpenId} onNew={() => setDrawer({ wl: null })} />}

      {drawer && <window.WL_EditDrawer wl={drawer.wl} onClose={() => setDrawer(null)} onSave={saveWaitlist} />}
      {dialog && dialog.kind === "broadcast" && <window.WL_BroadcastDialog wl={dialog.wl} onClose={() => setDialog(null)} onLaunch={doLaunch} />}
      {dialog && dialog.kind === "export" && <window.WL_ExportDialog wl={dialog.wl} onClose={() => setDialog(null)} />}
      {dialog && dialog.kind === "embed" && <window.WL_EmbedDialog wl={dialog.wl} onClose={() => setDialog(null)} />}
    </div>
  );
}

Object.assign(window, { WaitlistsView });
