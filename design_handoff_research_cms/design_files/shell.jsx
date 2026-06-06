/* ============================================================
   SHELL — sidebar, topbar, routing, bell, tweaks
   ============================================================ */
const NAV = [
  { sec: "Overview", items: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "upnext", label: "Up Next", icon: "upnext" },
    { id: "schedule", label: "Schedule", icon: "calendar" },
    { id: "analytics", label: "Analytics", icon: "trending" },
    { id: "notifications", label: "Notificações", icon: "bell", dynamicBadge: true },
  ]},
  { sec: "Content", items: [
    { id: "blog", label: "Blog", icon: "blog" },
    { id: "video", label: "Video", icon: "video" },
    { id: "courses", label: "Courses", icon: "courses" },
    { id: "newsletters", label: "Newsletters", icon: "mail", badges: [["amber","1"],["rose","2"]] },
    { id: "campaigns", label: "Campaigns", icon: "megaphone" },
    { id: "playlists", label: "Playlists", icon: "playlist" },
  ]},
  { sec: "Library", items: [
    { id: "research", label: "Research", icon: "research", badges: [["accent","1"]] },
    { id: "reference", label: "Reference", icon: "reference" },
    { id: "media", label: "Media", icon: "media" },
    { id: "audio", label: "Audio", icon: "audio" },
  ]},
  { sec: "Social", items: [
    { id: "youtube", label: "YouTube", icon: "youtube" },
    { id: "posts", label: "Posts", icon: "posts" },
    { id: "links", label: "Links", icon: "link" },
    { id: "linkbio", label: "Link in Bio", icon: "linkbio" },
  ]},
  { sec: "People", items: [
    { id: "authors", label: "Authors", icon: "authors" },
    { id: "subscribers", label: "Subscribers", icon: "user" },
    { id: "contacts", label: "Contacts", icon: "contacts" },
  ]},
];
const CORE = ["dashboard", "upnext", "schedule", "analytics", "notifications", "blog", "research"];
const TITLES = {
  dashboard: ["Dashboard", null], upnext: ["Up Next", null], schedule: ["Schedule", null],
  analytics: ["Analytics", null], notifications: ["Notificações", null], notifPrefs: ["Preferências", null],
  research: ["Research", null],
};
const ACCENTS = {
  coral:  { a: "#fb7a52", h: "#ff8e6a", p: "#e9663d", t: "#fb7a52", on: "#1a0d07" },
  orange: { a: "#f59e0b", h: "#ffb02e", p: "#d98509", t: "#f5a623", on: "#1a1205" },
  cyan:   { a: "#22b8d6", h: "#3fcdea", p: "#1b97b0", t: "#36c6e0", on: "#04161a" },
  green:  { a: "#22c55e", h: "#3ad675", p: "#1ba34c", t: "#34cf6a", on: "#04160a" },
  violet: { a: "#8b8cf6", h: "#a3a4ff", p: "#6e6fd6", t: "#9b9cff", on: "#0c0a1a" },
};

function Sidebar({ route, go, unread, onOpenCmd }) {
  return (
    <aside className="sidebar">
      <div className="sb-brand"><div className="sb-logo">TF</div><span className="sb-brand-name">ByThiagoFigueiredo</span></div>
      <button className="sb-search" onClick={onOpenCmd}>
        <Icon name="search" size={15} /><span className="sb-search-lbl">Pular para…</span><span className="sb-kbd">⌘K</span>
      </button>
      <div className="sb-scroll">
        {NAV.map(group => (
          <div key={group.sec}>
            <div className="sb-section-label"><span>{group.sec}</span></div>
            {group.items.map(it => {
              const active = route === it.id;
              const core = CORE.includes(it.id);
              return (
                <button key={it.id} className={"nav-item" + (active ? " active" : "")}
                  onClick={() => core ? go(it.id) : pushToast({ kind: "info", icon: it.icon, title: it.label, msg: "Protótipo focado em Overview + Notificações." })}>
                  <Icon name={it.icon} size={17} /><span className="lbl">{it.label}</span>
                  {it.dynamicBadge && unread > 0 && <span className="nav-badge"><span className="pill rose">{unread > 9 ? "9+" : unread}</span></span>}
                  {it.badges && <span className="nav-badge">{it.badges.map(([c, n], i) => <span key={i} className={"pill " + c}>{n}</span>)}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="sb-footer">
        <button className="nav-item" onClick={() => go("notifPrefs")}><Icon name="settings" size={17} /><span className="lbl">Settings</span></button>
        <div className="sb-user">
          <div className="avatar">TF</div>
          <div className="grow" style={{ minWidth: 0 }}><div className="sb-user-name truncate">thiagojfreak@gmail…</div><div className="sb-user-role">super_admin</div></div>
          <Icon name="chevronr" size={15} style={{ color: "var(--text-dim)" }} />
        </div>
      </div>
    </aside>
  );
}

function Topbar({ route, period, setPeriod, theme, toggleTheme, unread, crit, onBell, popoverOpen, openTweaks, bump }) {
  const [title] = TITLES[route] || ["", null];
  const showPeriod = route === "dashboard" || route === "analytics";
  const greet = route === "dashboard";
  return (
    <header className="topbar">
      <div>
        {greet ? <><div className="tb-title">Boa tarde, Thiago</div><div className="tb-sub" style={{ textTransform: "capitalize" }}>Sexta-feira, 29 de maio</div></>
          : <div className="tb-title">{title}</div>}
      </div>
      <div className="tb-actions">
        {showPeriod && <div className="seg">{["7 dias", "30 dias", "90 dias"].map(p => <button key={p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>{p}</button>)}</div>}
        <button className="icon-btn" onClick={openTweaks} title="Tweaks"><Icon name="sliders" size={17} /></button>
        <button className="icon-btn" onClick={toggleTheme} title="Tema"><Icon name={theme === "dark" ? "sun" : "moon"} size={17} /></button>
        <button className={"icon-btn bell-btn" + (popoverOpen ? " active" : "") + (bump ? " ring" : "")} onClick={onBell} aria-label={`Notificações, ${unread} não lidas`}>
          <Icon name="bell" size={18} />
          {unread > 0 && <span className={"notif-dot" + (crit ? " crit" : "") + (bump ? " bump" : "")}>{unread > 9 ? "9+" : unread}</span>}
        </button>
      </div>
    </header>
  );
}

function TweaksPanel({ density, setDensity, accent, setAccent, theme, toggleTheme, dataState, setDataState, onSimulate, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest('[title="Tweaks"]')) onClose(); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="notif-pop fade-in" ref={ref} style={{ width: 280, right: 96, padding: 0 }}>
      <div className="notif-pop-head"><Icon name="sliders" size={16} /><span style={{ fontWeight: 600, fontSize: 14 }}>Tweaks</span><div className="grow" /><button className="icon-btn bare" onClick={onClose}><Icon name="x" size={15} /></button></div>
      <div style={{ padding: 16 }} className="col gap-16">
        <div><div className="section-label" style={{ marginBottom: 8 }}>Tema</div>
          <div className="seg" style={{ width: "100%" }}>
            <button className={theme === "dark" ? "on" : ""} style={{ flex: 1 }} onClick={() => theme !== "dark" && toggleTheme()}>Escuro</button>
            <button className={theme === "light" ? "on" : ""} style={{ flex: 1 }} onClick={() => theme !== "light" && toggleTheme()}>Claro</button>
          </div>
        </div>
        <div><div className="section-label" style={{ marginBottom: 8 }}>Densidade</div>
          <div className="seg" style={{ width: "100%" }}>
            <button className={density === "comfortable" ? "on" : ""} style={{ flex: 1 }} onClick={() => setDensity("comfortable")}>Confortável</button>
            <button className={density === "compact" ? "on" : ""} style={{ flex: 1 }} onClick={() => setDensity("compact")}>Compacto</button>
          </div>
        </div>
        <div><div className="section-label" style={{ marginBottom: 8 }}>Cor de destaque</div>
          <div className="row gap-8">
            {Object.entries(ACCENTS).map(([k, v]) => (
              <button key={k} onClick={() => setAccent(k)} title={k}
                style={{ width: 32, height: 32, borderRadius: 9, background: v.a, border: accent === k ? "2px solid var(--text)" : "2px solid transparent", outline: "1px solid var(--border)" }} />
            ))}
          </div>
          <div className="dim fs11 mt-8">Padrão do site = coral.</div>
        </div>
        <div><div className="section-label" style={{ marginBottom: 8 }}>Estado dos dados</div>
          <div className="seg" style={{ width: "100%" }}>
            {[["loaded","Carregado"],["loading","Carregando"],["empty","Vazio"]].map(([k,l]) => (
              <button key={k} className={dataState === k ? "on" : ""} style={{ flex: 1 }} onClick={() => setDataState(k)}>{l}</button>
            ))}
          </div>
          <div className="dim fs11 mt-8">Veja skeletons de loading e estados vazios desenhados.</div>
        </div>
        <button className="btn primary" onClick={onSimulate}><Icon name="bell" size={15} /> Simular notificação</button>
      </div>
    </div>
  );
}

/* ---------------- COMMAND PALETTE (⌘K) ---------------- */
function CommandPalette({ go, onClose }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  const actions = [
    { id: "a-post", label: "Novo Post", sub: "Blog", icon: "blog", run: () => go("blog") },
    { id: "a-edicao", label: "Nova Edição", sub: "Newsletter", icon: "mail", run: () => pushToast({ kind: "info", icon: "mail", title: "Nova Edição", msg: "Abrindo editor…" }) },
    { id: "a-video", label: "Novo Vídeo", sub: "YouTube", icon: "video", run: () => pushToast({ kind: "info", icon: "video", title: "Novo Vídeo", msg: "Abrindo editor…" }) },
  ];
  const navItems = NAV.flatMap(g => g.items.map(it => ({
    id: "n-" + it.id, label: it.label, sub: g.sec, icon: it.icon,
    run: () => CORE.includes(it.id) ? go(it.id) : pushToast({ kind: "info", icon: it.icon, title: it.label, msg: "Protótipo focado em Overview + Notificações." }),
  })));

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const nq = norm(q);
  const flt = (arr) => nq ? arr.filter(x => norm(x.label + " " + x.sub).includes(nq)) : arr;
  const groups = [
    { sec: "Ações", items: flt(actions) },
    { sec: "Navegar", items: flt(navItems) },
  ].filter(g => g.items.length);
  const flat = groups.flatMap(g => g.items);
  const clamped = Math.min(sel, Math.max(0, flat.length - 1));

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const it = flat[clamped]; if (it) { it.run(); onClose(); } }
    else if (e.key === "Escape") { onClose(); }
  };

  let running = -1;
  return (
    <div className="cmdk-scrim" onClick={onClose}>
      <div className="cmdk" onClick={e => e.stopPropagation()} onKeyDown={onKey}>
        <div className="cmdk-input">
          <Icon name="search" size={17} style={{ color: "var(--text-dim)" }} />
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setSel(0); }} placeholder="Buscar páginas e ações…" />
          <span className="cmdk-esc">esc</span>
        </div>
        <div className="cmdk-list">
          {flat.length === 0 && <div className="cmdk-empty">Nada encontrado para “{q}”.</div>}
          {groups.map(g => (
            <div key={g.sec}>
              <div className="cmdk-sec">{g.sec}</div>
              {g.items.map(it => { running++; const on = running === clamped; const idx = running; return (
                <button key={it.id} className={"cmdk-row" + (on ? " on" : "")} onMouseEnter={() => setSel(idx)} onClick={() => { it.run(); onClose(); }}>
                  <span className="cmdk-ico"><Icon name={it.icon} size={15} /></span>
                  <span className="cmdk-lbl">{it.label}</span>
                  <span className="cmdk-sub">{it.sub}</span>
                  {on && <Icon name="arrowright" size={14} style={{ color: "var(--text-dim)" }} />}
                </button>
              ); })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- APP ---------------- */
function App() {
  const ROUTES = ["dashboard","upnext","schedule","analytics","notifications","blog","research","notifPrefs"];
  const hashRoute = () => { const h = (location.hash || "").replace(/^#/, ""); return ROUTES.includes(h) ? h : "dashboard"; };
  const [route, setRoute] = useState(hashRoute);
  const [theme, setTheme] = useState("dark");
  const [density, setDensity] = useState("comfortable");
  const [accent, setAccent] = useState("coral");
  const [period, setPeriod] = useState("7 dias");
  const [popover, setPopover] = useState(false);
  const [tweaks, setTweaks] = useState(false);
  const [notifs, setNotifs] = useState(window.DATA.notifications);
  const [dataState, setDataState] = useState("loaded");
  const [bump, setBump] = useState(false);
  const [cmdk, setCmdk] = useState(false);

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdk(c => !c); setPopover(false); setTweaks(false); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    const onHash = () => { const r = hashRoute(); setRoute(prev => prev === r ? prev : r); };
    window.addEventListener("hashchange", onHash); return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => { document.documentElement.setAttribute("data-density", density); }, [density]);
  useEffect(() => {
    const v = ACCENTS[accent], r = document.documentElement.style;
    r.setProperty("--accent", v.a); r.setProperty("--accent-hover", v.h); r.setProperty("--accent-press", v.p);
    r.setProperty("--accent-text", theme === "light" ? v.p : v.t); r.setProperty("--on-accent", v.on);
    r.setProperty("--accent-soft", `color-mix(in srgb, ${v.a} 14%, transparent)`);
    r.setProperty("--accent-soft-2", `color-mix(in srgb, ${v.a} 24%, transparent)`);
  }, [accent, theme]);

  const unread = notifs.filter(n => !n.read).length;
  const crit = notifs.some(n => !n.read && n.priority >= 5);
  const go = useCallback((r) => { setRoute(r); setPopover(false); try { history.replaceState(null, "", "#" + r); } catch {} document.querySelector(".content")?.scrollTo(0, 0); }, []);
  const toggleTheme = useCallback(() => {
    const el = document.documentElement;
    el.classList.add("theme-switching");
    setTheme(t => t === "dark" ? "light" : "dark");
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("theme-switching")));
  }, []);

  const toggleRead = (id, force) => setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: force != null ? force : !n.read } : n));
  const dismiss = (id) => { setNotifs(ns => ns.filter(n => n.id !== id)); pushToast({ kind: "info", title: "Notificação dispensada", icon: "archive" }); };
  const markAll = () => setNotifs(ns => ns.map(n => ({ ...n, read: true })));
  const routeMap = { settingsNotif: "notifPrefs" };
  const onAction = (n) => { toggleRead(n.id, true); go(routeMap[n.route] || n.route || "notifications"); };
  const simulate = () => {
    const n = { id: "sim" + Date.now(), domain: "youtube", priority: 5, mins: 0, read: false,
      title: "Comentário em alta no YouTube", msg: "“De Pro Gamer a Programador” recebeu um comentário ganhando tração agora.",
      action: "Ver vídeo", route: "analytics", icon: "flame" };
    setNotifs(ns => [n, ...ns]);
    pushToast({ kind: "warning", title: "YouTube · prioridade alta", msg: n.title, icon: "youtube", actionLabel: "Ver", onAction: () => go("analytics") });
    setBump(true); setTimeout(() => setBump(false), 1500);
  };

  return (
    <div className="app">
      <Sidebar route={route} go={go} unread={unread} onOpenCmd={() => setCmdk(true)} />
      <div className="main">
        <div style={{ position: "relative" }}>
          <Topbar route={route} period={period} setPeriod={setPeriod} theme={theme} toggleTheme={toggleTheme}
            unread={unread} crit={crit} onBell={() => { setPopover(p => !p); setTweaks(false); }} popoverOpen={popover} openTweaks={() => { setTweaks(t => !t); setPopover(false); }} bump={bump} />
          {popover && <div style={{ position: "absolute", top: 0, right: 30, zIndex: 80 }}>
            <NotifPopover notifs={notifs} onClose={() => setPopover(false)} onAction={onAction} onToggleRead={toggleRead} onDismiss={dismiss}
              markAll={markAll} goInbox={() => go("notifications")} goPrefs={() => go("notifPrefs")} />
          </div>}
          {tweaks && <div style={{ position: "absolute", top: 0, right: 30, zIndex: 80 }}>
            <TweaksPanel density={density} setDensity={setDensity} accent={accent} setAccent={setAccent} theme={theme} toggleTheme={toggleTheme} dataState={dataState} setDataState={setDataState} onSimulate={() => { simulate(); setTweaks(false); }} onClose={() => setTweaks(false)} />
          </div>}
        </div>
        <div className="content">
          <div className="content-inner">
            {route === "dashboard" && <DashboardView notifs={notifs} go={go} onNotifAction={onAction} state={dataState} />}
            {route === "upnext" && <UpNextView go={go} />}
            {route === "schedule" && <ScheduleView state={dataState} go={go} />}
            {route === "blog" && <BlogView go={go} theme={theme} />}
            {route === "research" && <ResearchView />}
            {route === "analytics" && <AnalyticsView state={dataState} />}
            {route === "notifications" && <InboxView notifs={notifs} onAction={onAction} onToggleRead={toggleRead} onDismiss={dismiss} markAll={markAll} goPrefs={() => go("notifPrefs")} state={dataState} />}
            {route === "notifPrefs" && <PrefsView goInbox={() => go("notifications")} />}
          </div>
        </div>
      </div>
      <ToastHost />
      {cmdk && <CommandPalette go={go} onClose={() => setCmdk(false)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
