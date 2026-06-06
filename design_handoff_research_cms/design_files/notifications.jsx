/* ============================================================
   NOTIFICATIONS — popover, Inbox page, Preferences, toasts
   ============================================================ */

/* ---------- single row ---------- */
function NotifRow({ n, full, selected, onSelect, onAction, onToggleRead, onDismiss }) {
  const [leaving, setLeaving] = useState(false);
  const dm = DOMAINS[n.domain];
  const doDismiss = () => { setLeaving(true); setTimeout(() => onDismiss(n.id), 260); };
  const pri = n.priority >= 5 ? { c: "var(--danger)", l: "Crítico" }
    : n.priority >= 4 ? { c: "var(--warn)", l: "Alta" }
    : { c: dm.color, l: "" };
  return (
    <div className={"notif-row" + (n.read ? " read" : "") + (full ? " full" : "") + (leaving ? " leaving" : "")}
      style={{ "--dc": dm.color, "--ds": dm.soft }} role="listitem" tabIndex={0}
      aria-label={`${pri.l ? pri.l + ", " : ""}${dm.label}: ${n.title}. ${n.read ? "lida" : "não lida"}`}
      onKeyDown={(e) => { if (e.key === "Enter" && n.action) { e.preventDefault(); onAction(n); } if ((e.key === "Backspace" || e.key === "Delete")) { e.preventDefault(); doDismiss(); } }}>
      {full && (
        <button className={"nrow-check" + (selected ? " on" : "")} onClick={() => onSelect(n.id)}>
          {selected && <Icon name="check" size={12} sw={3} />}
        </button>
      )}
      <div className="nrow-ico" style={{ background: dm.soft, color: dm.color }}>
        <Icon name={n.icon || dm.icon} size={16} />
      </div>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row gap-8" style={{ alignItems: "baseline" }}>
          {!n.read && <span className="unread-dot" />}
          <span className="nrow-title">{n.title}</span>
          {n.priority >= 4 && <span className="nrow-pri" style={{ color: pri.c, background: "color-mix(in srgb,"+pri.c+" 14%, transparent)" }}>{pri.l}</span>}
          <span className="nrow-time mono">{rel(n.mins)}</span>
        </div>
        <div className="nrow-msg">{n.msg}</div>
        <div className="row gap-8 mt-8" style={{ flexWrap: "wrap" }}>
          <span className="nrow-domain" style={{ color: dm.color }}>
            <Icon name={dm.icon} size={11} /> {dm.label}
          </span>
          <div className="grow" />
          {n.action && <button className="btn sm ghost" onClick={() => onAction(n)}>{n.action}</button>}
          <button className="btn sm ghost icon-only" title={n.read ? "Marcar não lida" : "Marcar lida"} aria-label={n.read ? "Marcar não lida" : "Marcar lida"} onClick={() => onToggleRead(n.id)}>
            <Icon name={n.read ? "bell" : "check"} size={14} />
          </button>
          <button className="btn sm ghost icon-only" title="Dispensar" aria-label="Dispensar notificação" onClick={doDismiss}>
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- grouping ---------- */
function groupList(list) {
  const seen = {}, out = [];
  list.forEach(n => {
    if (n.group) {
      if (seen[n.group] == null) { seen[n.group] = out.length; out.push({ thread: n.group, items: [n] }); }
      else out[seen[n.group]].items.push(n);
    } else out.push({ single: n });
  });
  return out;
}

function NotifThread({ items, full, onAction, onToggleRead, onDismiss, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const dm = DOMAINS[items[0].domain];
  if (items.length < 3) return <>{items.map(n => <NotifRow key={n.id} n={n} full={full} selected={selected && selected.has(n.id)} onSelect={onSelect} onAction={onAction} onToggleRead={onToggleRead} onDismiss={onDismiss} />)}</>;
  const unread = items.filter(i => !i.read).length;
  const total = items.reduce((a, b) => a + (parseInt((b.title.match(/\d+/) || [0])[0]) || 0), 0);
  return (
    <div className="notif-thread" style={{ "--dc": dm.color, "--ds": dm.soft }}>
      <button className={"thread-head" + (open ? " open" : "")} onClick={() => setOpen(o => !o)}>
        <div className="nrow-ico" style={{ background: dm.soft, color: dm.color }}><Icon name={dm.icon} size={16} /></div>
        <div className="grow" style={{ minWidth: 0, textAlign: "left" }}>
          <div className="row gap-8" style={{ alignItems: "baseline" }}>
            {unread > 0 && <span className="unread-dot" />}
            <span className="nrow-title">{items.length} atualizações de {dm.label}</span>
            <span className="thread-count">{total} cliques</span>
            <span className="nrow-time mono">{rel(items[0].mins)}</span>
          </div>
          <div className="nrow-msg truncate">{items.map(i => i.title).join(" · ")}</div>
        </div>
        <Icon name="chevrond" size={16} style={{ transform: open ? "rotate(180deg)" : "none", transition: ".2s", color: "var(--text-dim)", flexShrink: 0 }} />
      </button>
      {open && <div className="thread-body fade-in">{items.map(n => <NotifRow key={n.id} n={n} full={full} selected={selected && selected.has(n.id)} onSelect={onSelect} onAction={onAction} onToggleRead={onToggleRead} onDismiss={onDismiss} />)}</div>}
    </div>
  );
}

/* ---------- POPOVER ---------- */
function NotifPopover({ notifs, onClose, onAction, onToggleRead, onDismiss, markAll, goInbox, goPrefs }) {
  const [filter, setFilter] = useState("all");
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest(".bell-btn")) onClose(); };
    const k = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, []);
  const list = notifs.filter(n => filter === "all" ? true : filter === "unread" ? !n.read : n.domain === filter);
  const unread = notifs.filter(n => !n.read).length;
  return (
    <div className="notif-pop fade-in" ref={ref} role="dialog" aria-label="Notificações">
      <div className="notif-pop-head">
        <span style={{ fontWeight: 600, fontSize: 14 }}>Notificações</span>
        {unread > 0 && <span className="pill accent">{unread}</span>}
        <div className="grow" />
        <button className="btn sm ghost" onClick={markAll} disabled={!unread}><Icon name="checkcheck" size={14} /> Marcar todas</button>
        <button className="icon-btn bare" title="Preferências" onClick={goPrefs}><Icon name="settings" size={16} /></button>
      </div>
      <div className="notif-chips">
        {[["all","Todas"],["unread","Não lidas"],["pipeline","Pipeline"],["youtube","YouTube"],["newsletter","NL"],["social","Social"],["links","Links"],["system","Sistema"]].map(([k,l]) => (
          <button key={k} className={"chip sm" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="notif-pop-list">
        {list.length === 0
          ? <EmptyState icon="checkcheck" title="Tudo em dia" sub="Nenhuma notificação aqui. Você está em dia." />
          : groupList(list).slice(0, 8).map((g, i) => g.single
              ? <NotifRow key={g.single.id} n={g.single} onAction={onAction} onToggleRead={onToggleRead} onDismiss={onDismiss} />
              : <NotifThread key={"t" + i} items={g.items} onAction={onAction} onToggleRead={onToggleRead} onDismiss={onDismiss} />)}
      </div>
      <button className="notif-pop-foot" onClick={goInbox}>Ver todas as notificações <Icon name="arrowright" size={14} /></button>
    </div>
  );
}

/* ---------- INBOX PAGE ---------- */
function InboxView({ notifs, onAction, onToggleRead, onDismiss, markAll, goPrefs, state }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(new Set());
  if (state === "loading") return <SkelInbox />;
  if (state === "empty") return <EmptyInbox />;
  const toggleSel = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filtered = notifs.filter(n =>
    (filter === "all" ? true : filter === "unread" ? !n.read : n.domain === filter) &&
    (q === "" || (n.title + n.msg).toLowerCase().includes(q.toLowerCase()))
  );
  // group by time bucket
  const buckets = { "Hoje": [], "Ontem": [], "Esta semana": [] };
  filtered.forEach(n => {
    const b = n.mins < 60 * 14 ? "Hoje" : n.mins < 60 * 38 ? "Ontem" : "Esta semana";
    buckets[b].push(n);
  });
  const counts = { all: notifs.length, unread: notifs.filter(n => !n.read).length };
  Object.keys(DOMAINS).forEach(d => counts[d] = notifs.filter(n => n.domain === d).length);
  const tabs = [["all","Todas"],["unread","Não lidas"],...Object.entries(DOMAINS).map(([k,v]) => [k, v.label])];

  return (
    <div className="fade-in">
      <div className="row between" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="tb-title" style={{ fontSize: 22 }}>Caixa de notificações</h1>
          <div className="tb-sub mt-4">{counts.unread} não lidas · {counts.all} no total</div>
        </div>
        <div className="row gap-8">
          <button className="btn" onClick={markAll}><Icon name="checkcheck" size={15} /> Marcar todas lidas</button>
          <button className="btn primary" onClick={goPrefs}><Icon name="settings" size={15} /> Preferências</button>
        </div>
      </div>

      <div className="row gap-8 wrap" style={{ marginBottom: 14 }}>
        {tabs.map(([k, l]) => (
          <button key={k} className={"chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
            {DOMAINS[k] && <span className="dot" style={{ width: 7, height: 7, borderRadius: 9, background: DOMAINS[k].color, display: "inline-block", marginRight: 6 }} />}
            {l} {counts[k] > 0 && <span className="dim" style={{ marginLeft: 4 }}>{counts[k]}</span>}
          </button>
        ))}
        <div className="grow" />
        <div className="search-box">
          <Icon name="search" size={15} />
          <input placeholder="Buscar notificações…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {sel.size > 0 && (
        <div className="bulk-bar fade-in">
          <span className="fw5">{sel.size} selecionada(s)</span>
          <div className="grow" />
          <button className="btn sm ghost" onClick={() => { sel.forEach(id => onToggleRead(id, true)); setSel(new Set()); }}><Icon name="check" size={14} /> Marcar lidas</button>
          <button className="btn sm ghost" onClick={() => { sel.forEach(id => onDismiss(id)); setSel(new Set()); }}><Icon name="archive" size={14} /> Dispensar</button>
          <button className="btn sm ghost" onClick={() => setSel(new Set())}>Cancelar</button>
        </div>
      )}

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon="inbox" title="Nada por aqui" sub="Não há notificações que correspondam a este filtro." />
        ) : (
          Object.entries(buckets).map(([b, arr]) => arr.length === 0 ? null : (
            <div key={b}>
              <div className="bucket-label">{b}</div>
              {groupList(arr).map((g, i) => g.single
                ? <NotifRow key={g.single.id} n={g.single} full selected={sel.has(g.single.id)} onSelect={toggleSel} onAction={onAction} onToggleRead={onToggleRead} onDismiss={onDismiss} />
                : <NotifThread key={"t" + i} items={g.items} full selected={sel} onSelect={toggleSel} onAction={onAction} onToggleRead={onToggleRead} onDismiss={onDismiss} />)}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

/* ---------- PREFERENCES PAGE ---------- */
const PRESETS = {
  calm:    { label: "Calmo",   sub: "Só o crítico", desc: "Apenas alertas de segurança e prioridade 5." },
  regular: { label: "Regular", sub: "Equilibrado",  desc: "Prioridade 3+ no app, 4+ por e-mail." },
  power:   { label: "Power",   sub: "Tudo",         desc: "Toda atividade, incluindo digests e sugestões." },
};
const CHANNELS = [["in_app","In-app","bell"],["email","E-mail","mail"],["push","Push","phone"],["telegram","Telegram","posts"]];

function PrefsView({ goInbox }) {
  const [preset, setPreset] = useState("regular");
  const [channels, setChannels] = useState({ in_app: true, email: true, push: false, telegram: true });
  const [quiet, setQuiet] = useState(true);
  const [cats, setCats] = useState(() => {
    const o = {};
    Object.keys(DOMAINS).forEach(d => o[d] = { in_app: true, email: d === "system" || d === "pipeline", push: false, telegram: d === "social" });
    return o;
  });
  const [open, setOpen] = useState("pipeline");
  const setCat = (dom, ch) => setCats(c => ({ ...c, [dom]: { ...c[dom], [ch]: !c[dom][ch] } }));

  return (
    <div className="fade-in" style={{ maxWidth: 860 }}>
      <div className="row between" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="tb-title" style={{ fontSize: 22 }}>Preferências de notificação</h1>
          <div className="tb-sub mt-4">Controle o que chega até você e por onde.</div>
        </div>
        <button className="btn ghost" onClick={goInbox}><Icon name="chevronl" size={15} /> Voltar à caixa</button>
      </div>

      {/* channels */}
      <Card className="mt-8"><CardHead icon="rss" title="Canais de entrega" />
        <div className="card-pad grid g-cols-2" style={{ gap: 12 }}>
          {CHANNELS.map(([k, l, ic]) => (
            <button key={k} className={"channel" + (channels[k] ? " on" : "")} onClick={() => setChannels(c => ({ ...c, [k]: !c[k] }))}>
              <div className="channel-ico"><Icon name={ic} size={17} /></div>
              <div className="grow" style={{ textAlign: "left" }}>
                <div className="fw5 fs13">{l}</div>
                <div className="dim fs11">{k === "telegram" ? "@thiago conectado" : k === "push" ? "Pedir permissão" : k === "email" ? "thiagojfreak@gmail.com" : "Centro de notificações"}</div>
              </div>
              <span className={"switch" + (channels[k] ? " on" : "")}><i /></span>
            </button>
          ))}
        </div>
      </Card>

      {/* presets */}
      <Card className="mt-16"><CardHead icon="gauge" title="Frequência" />
        <div className="card-pad grid g-cols-3" style={{ gap: 12 }}>
          {Object.entries(PRESETS).map(([k, p]) => (
            <button key={k} className={"preset" + (preset === k ? " on" : "")} onClick={() => setPreset(k)}>
              <div className="row between"><span className="fw6">{p.label}</span>
                <span className={"radio" + (preset === k ? " on" : "")} />
              </div>
              <div className="fs12" style={{ color: "var(--accent-text)", fontWeight: 500, marginTop: 2 }}>{p.sub}</div>
              <div className="dim fs12 mt-8" style={{ lineHeight: 1.4 }}>{p.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* per-category */}
      <Card className="mt-16"><CardHead icon="sliders" title="Por categoria" right={<span className="dim fs12" style={{ marginLeft: "auto" }}>in-app · e-mail · push · telegram</span>} />
        <div>
          {Object.entries(DOMAINS).map(([dom, dm]) => (
            <div key={dom} className="cat-block">
              <button className="cat-head" onClick={() => setOpen(open === dom ? null : dom)}>
                <span className="cat-ico" style={{ background: dm.soft, color: dm.color }}><Icon name={dm.icon} size={15} /></span>
                <span className="fw5 fs13">{dm.label}</span>
                {dom === "system" && <span className="badge" style={{ marginLeft: 8 }}><Icon name="info" size={11} /> Obrigatório</span>}
                <div className="grow" />
                <span className="dim fs12">{CHANNELS.filter(([c]) => cats[dom][c]).length} canais</span>
                <Icon name="chevrond" size={16} style={{ transform: open === dom ? "rotate(180deg)" : "none", transition: ".2s", color: "var(--text-dim)" }} />
              </button>
              {open === dom && (
                <div className="cat-body fade-in">
                  {CHANNELS.map(([ch, cl, ci]) => {
                    const required = dom === "system" && ch === "in_app";
                    return (
                      <div key={ch} className="cat-row">
                        <Icon name={ci} size={14} style={{ color: "var(--text-dim)" }} />
                        <span className="fs13">{cl}</span>
                        <div className="grow" />
                        <span className={"switch" + ((cats[dom][ch] || required) ? " on" : "") + (required ? " locked" : "")}
                          onClick={() => !required && setCat(dom, ch)}><i /></span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* quiet hours */}
      <Card className="mt-16"><CardHead icon="moon" title="Horário de silêncio" />
        <div className="card-pad row between">
          <div>
            <div className="fs13 fw5">Pausar não-críticas das 22h às 8h</div>
            <div className="dim fs12 mt-4">Só prioridade 5 (crítico) passa nesse período.</div>
          </div>
          <span className={"switch" + (quiet ? " on" : "")} onClick={() => setQuiet(q => !q)}><i /></span>
        </div>
      </Card>

      <div className="dim fs11 mt-16" style={{ display: "flex", gap: 7, alignItems: "center", justifyContent: "center" }}>
        <Icon name="info" size={13} /> Conforme a LGPD: alertas de segurança não podem ser desativados; e-mail/push exigem opt-in explícito.
      </div>
    </div>
  );
}

/* ---------- TOASTS ---------- */
let _pushToast = () => {};
function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    _pushToast = (t) => {
      const id = Math.random().toString(36).slice(2);
      setToasts(ts => [...ts, { ...t, id }]);
      setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), t.duration || 4200);
    };
  }, []);
  const KIND = {
    success: { c: "var(--ok)", ic: "checkcircle" }, error: { c: "var(--danger)", ic: "warn" },
    warning: { c: "var(--warn)", ic: "warn" }, info: { c: "var(--c-pipeline)", ic: "info" },
  };
  return (
    <div className="toast-host" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map(t => {
        const k = KIND[t.kind || "info"];
        return (
          <div key={t.id} className="toast fade-in" style={{ "--tc": k.c }}>
            <div className="toast-ico" style={{ color: k.c }}><Icon name={t.icon || k.ic} size={17} /></div>
            <div className="grow">
              <div className="fw6 fs13">{t.title}</div>
              {t.msg && <div className="dim fs12 mt-4">{t.msg}</div>}
            </div>
            {t.actionLabel && <button className="btn sm ghost" onClick={() => { t.onAction && t.onAction(); setToasts(ts => ts.filter(x => x.id !== t.id)); }}>{t.actionLabel}</button>}
            <button className="icon-btn bare" onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))}><Icon name="x" size={15} /></button>
          </div>
        );
      })}
    </div>
  );
}
const pushToast = (t) => _pushToast(t);

Object.assign(window, { NotifRow, NotifPopover, InboxView, PrefsView, ToastHost, pushToast });
