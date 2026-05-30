/* ============================================================
   NOTIFICATIONS — popover, Inbox page, Preferences, toasts
   ============================================================ */

/* ---------- single row ---------- */
function NotifRow({ n, full, selected, onSelect, onAction, onToggleRead, onDismiss, rowRef }) {
  const [leaving, setLeaving] = useState(false);
  const elRef = useRef(null);
  const dm = DOMAINS[n.domain];
  const doDismiss = () => {
    setLeaving(true);
    /* After dismiss animation, move focus to next/prev sibling row before removing from DOM */
    setTimeout(() => {
      const el = elRef.current;
      if (el) {
        const next = el.nextElementSibling?.querySelector('[role="listitem"]') || el.nextElementSibling;
        const prev = el.previousElementSibling?.querySelector('[role="listitem"]') || el.previousElementSibling;
        const target = next || prev || el.closest('[role="list"]')?.parentElement;
        if (target && target.focus) target.focus();
      }
      onDismiss(n.id);
    }, 260);
  };
  /* Priority badges always use semantic colors (danger/warn) regardless of domain */
  const pri = n.priority >= 5 ? { c: "var(--danger)", l: "Crítico" }
    : n.priority >= 4 ? { c: "var(--warn)", l: "Alta" }
    : { c: dm.color, l: "" };
  return (
    <div ref={elRef} className={"notif-row" + (n.read ? " read" : "") + (!n.read ? " unread" : "") + (full ? " full" : "") + (leaving ? " leaving" : "")}
      style={{ "--dc": dm.color, "--ds": dm.soft }} role="listitem" tabIndex={0}
      aria-label={`${pri.l ? pri.l + ", " : ""}${dm.label}: ${n.title}. ${n.read ? "lida" : "não lida"}`}
      aria-description="Pressione Tab para ações, Delete para dispensar"
      aria-keyshortcuts="Enter Delete"
      onClick={(e) => { if (!e.target.closest("button") && n.action) { onAction(n); } }}
      onKeyDown={(e) => { if (e.key === "Enter" && n.action) { e.preventDefault(); onAction(n); } if ((e.key === "Backspace" || e.key === "Delete")) { e.preventDefault(); doDismiss(); } }}>
      {full && (
        <button role="checkbox" aria-checked={!!selected} aria-label={`Selecionar notificação: ${n.title}`}
          className={"nrow-check" + (selected ? " on" : "")} onClick={() => onSelect(n.id)}>
          {selected && <Icon name="check" size={12} sw={3} />}
        </button>
      )}
      <div className="nrow-ico" style={{ background: dm.soft, color: dm.color }}>
        <Icon name={n.icon || dm.icon} size={16} />
      </div>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row gap-8" style={{ alignItems: "baseline" }}>
          {!n.read && <span className="unread-dot" aria-hidden="true" />}
          <span className="nrow-title">{n.title}</span>
          {n.priority >= 4 && <span className="nrow-pri" style={{ color: pri.c, background: "color-mix(in srgb,"+pri.c+" 14%, transparent)" }}>{pri.l}</span>}
          <span className="nrow-time mono">{rel(n.mins)}</span>
        </div>
        <div className="row gap-8" style={{ alignItems: "center", marginTop: 3 }}>
          <span className="nrow-msg" style={{ marginTop: 0 }}>{n.msg}</span>
          <span className="nrow-domain" style={{ color: dm.color, flexShrink: 0 }}>
            <Icon name={dm.icon} size={11} /> {dm.label}
          </span>
          <div className="grow" />
          <span className="nrow-actions row gap-8">
            {n.action && <button className="btn sm ghost" onClick={() => onAction(n)}>{n.action}</button>}
            <button className="btn sm ghost icon-only" title={n.read ? "Marcar não lida" : "Marcar lida"} aria-label={n.read ? "Marcar não lida" : "Marcar lida"} onClick={() => onToggleRead(n.id)}>
              <Icon name={n.read ? "bell" : "check"} size={14} />
            </button>
            <button className="btn sm ghost icon-only" title="Dispensar" aria-label="Dispensar notificação" onClick={doDismiss}>
              <Icon name="x" size={14} />
            </button>
            {/* TODO: Add snooze button with duration picker (15min, 1h, 3h, Tomorrow 9am, Monday 9am).
                On mobile (<640px), render as BottomDrawer action sheet instead of dropdown. */}
          </span>
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

function NotifThread({ items, full, onAction, onToggleRead, onDismiss, selected, onSelect, goInbox, maxExpanded }) {
  const [open, setOpen] = useState(false);
  const dm = DOMAINS[items[0].domain];
  if (items.length < 3) return <>{items.map(n => <NotifRow key={n.id} n={n} full={full} selected={selected && selected.has(n.id)} onSelect={onSelect} onAction={onAction} onToggleRead={onToggleRead} onDismiss={onDismiss} />)}</>;
  const unread = items.filter(i => !i.read).length;
  const cap = maxExpanded || items.length;
  const visibleItems = items.slice(0, cap);
  const overflow = items.length - cap;
  const threadSummary = (() => {
    if (dm.label === "Links") {
      const sum = items.reduce((a, b) => a + (parseInt((b.title.match(/\d+/) || [0])[0]) || 0), 0);
      return sum > 0 ? `${sum} cliques` : `${items.length} atualizações`;
    }
    return `${items.length} atualizações`;
  })();
  const allThreadIds = items.map(i => i.id);
  const allSelected = selected && allThreadIds.every(id => selected.has(id));
  const toggleThreadSel = () => {
    if (!onSelect) return;
    if (allSelected) { allThreadIds.forEach(id => onSelect(id)); }
    else { allThreadIds.forEach(id => { if (!selected.has(id)) onSelect(id); }); }
  };
  const threadContent = (
    <div className={full ? "thread-inner" : undefined} style={!full ? undefined : { flex: 1, minWidth: 0 }}>
      <div className="notif-thread" role="listitem" style={{ "--dc": dm.color, "--ds": dm.soft }}>
        <button className={"thread-head" + (open ? " open" : "")} onClick={() => setOpen(o => !o)}
          aria-expanded={open} aria-controls={`thread-body-${items[0].id}`}
          aria-label={`${items.length} atualizações de ${dm.label}, ${unread} não lidas. ${threadSummary}`}>
          <div className="nrow-ico" style={{ background: dm.soft, color: dm.color }}><Icon name={dm.icon} size={16} /></div>
          <div className="grow" style={{ minWidth: 0, textAlign: "left" }}>
            <div className="row gap-8" style={{ alignItems: "baseline" }}>
              {unread > 0 && <span className="unread-dot" aria-hidden="true" />}
              <span className="nrow-title">{items.length} atualizações de {dm.label}</span>
              <span className="thread-count">{threadSummary}</span>
              <span className="nrow-time mono">{rel(items[0].mins)}</span>
            </div>
            <div className="nrow-msg truncate">{items.map(i => i.title).join(" · ")}</div>
          </div>
          <Icon name="chevrond" size={16} style={{ transform: open ? "rotate(180deg)" : "none", transition: ".28s", color: "var(--text-dim)", flexShrink: 0 }} />
        </button>
        {open && <div id={`thread-body-${items[0].id}`} className="thread-body thread-expand" role="list">
          {visibleItems.map(n => <NotifRow key={n.id} n={n} full={full} selected={selected && selected.has(n.id)} onSelect={onSelect} onAction={onAction} onToggleRead={onToggleRead} onDismiss={onDismiss} />)}
          {overflow > 0 && <button className="notif-pop-foot" style={{ borderTop: "none", fontSize: 12 }} onClick={() => goInbox && goInbox()}>Ver mais {overflow} de {dm.label} <Icon name="arrowright" size={14} /></button>}
        </div>}
      </div>
    </div>
  );
  if (full) {
    return (
      <div className="thread-check-wrap">
        <button role="checkbox" aria-checked={!!allSelected} aria-label={`Selecionar todas de ${dm.label}`}
          className={"nrow-check" + (allSelected ? " on" : "")} onClick={toggleThreadSel}>
          {allSelected && <Icon name="check" size={12} sw={3} />}
        </button>
        {threadContent}
      </div>
    );
  }
  return threadContent;
}

/* ---------- POPOVER ---------- */
/* Filter labels for empty states */
const FILTER_LABELS = { all: "Todas", unread: "Não lidas", pipeline: "Pipeline", youtube: "YouTube", newsletter: "Newsletter", social: "Social", links: "Links", system: "Sistema" };

function NotifPopover({ notifs, onClose, onAction, onToggleRead, onDismiss, markAll, goInbox, goPrefs, filter: externalFilter, setFilter: externalSetFilter }) {
  /* Filter state: use external (lifted) state if provided, otherwise local */
  const [localFilter, localSetFilter] = useState("all");
  const filter = externalFilter || localFilter;
  const setFilter = externalSetFilter || localSetFilter;

  const ref = useRef(null);
  const liveRef = useRef(null);
  const bellRef = useRef(null);

  /* Click-outside + Escape + focus trap */
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest(".bell-btn")) onClose(); };
    const k = (e) => {
      if (e.key === "Escape") {
        onClose();
        /* Return focus to bell trigger on close */
        const bell = document.querySelector(".bell-btn");
        if (bell) bell.focus();
      }
    };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, []);

  const list = notifs.filter(n => filter === "all" ? true : filter === "unread" ? !n.read : n.domain === filter);
  const unread = notifs.filter(n => !n.read).length;
  const total = notifs.length;
  const groups = groupList(list).slice(0, 8);
  const showing = Math.min(list.length, 8);

  /* Announce filter results to screen readers via aria-live region */
  useEffect(() => {
    if (liveRef.current) {
      const label = FILTER_LABELS[filter] || filter;
      if (list.length === 0) {
        liveRef.current.textContent = filter === "all"
          ? "Nenhuma notificação pendente."
          : filter === "unread"
            ? "Nenhuma notificação não lida."
            : `Nenhuma notificação de ${label}.`;
      } else {
        liveRef.current.textContent = `${list.length} notificação${list.length > 1 ? "ões" : ""} ${filter === "all" ? "" : "de " + label}`;
      }
    }
  }, [filter, list.length]);

  /* Roving tabindex for radio chips */
  const chipKeys = ["all","unread","pipeline","youtube","newsletter","social","links","system"];
  const handleChipKeyDown = (e, idx) => {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next = (idx + 1) % chipKeys.length; }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); next = (idx - 1 + chipKeys.length) % chipKeys.length; }
    if (next >= 0) {
      setFilter(chipKeys[next]);
      const chips = ref.current?.querySelectorAll('[role="radio"]');
      if (chips && chips[next]) chips[next].focus();
    }
  };

  /* Mark all with undo toast */
  const handleMarkAll = () => {
    const prevUnread = notifs.filter(n => !n.read).map(n => n.id);
    markAll();
    pushToast({
      kind: "success", title: "Todas marcadas como lidas", icon: "checkcheck",
      actionLabel: "Desfazer", duration: 7000,
      onAction: () => { /* In production: revert using prevUnread IDs via dispatch REVERT_MARK_ALL */ }
    });
  };

  /* Empty state varies by active filter */
  const renderEmpty = () => {
    if (filter === "all") return <EmptyState icon="checkcheck" title="Tudo em dia" sub="Nenhuma notificação pendente." />;
    if (filter === "unread") return <EmptyState icon="checkcheck" title="Nenhuma não lida" sub="Todas as notificações foram lidas." />;
    const label = FILTER_LABELS[filter] || filter;
    return <EmptyState icon="inbox" title={`Nenhuma de ${label}`} sub={`Não há notificações de ${label} no momento.`} />;
  };

  return (
    <div className="notif-pop fade-in" ref={ref} role="dialog" aria-modal="true" aria-label="Notificações">
      {/* Visually hidden live region for filter announcements */}
      <div ref={liveRef} aria-live="polite" role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }} />

      <div className="notif-pop-head">
        <span style={{ fontWeight: 600, fontSize: 14 }}>Notificações</span>
        {unread > 0 && <span className="pill accent">{unread}</span>}
        <div className="grow" />
        <button className="btn sm ghost" onClick={handleMarkAll} disabled={!unread} aria-label="Marcar todas como lidas" style={{ minHeight: 44 }}><Icon name="checkcheck" size={14} /> Marcar todas</button>
        <button className="icon-btn bare" title="Preferências" aria-label="Preferências de notificação" onClick={goPrefs} style={{ minWidth: 44, minHeight: 44 }}><Icon name="settings" size={16} /></button>
      </div>
      <div className="notif-chips" role="radiogroup" aria-label="Filtrar notificações">
        {chipKeys.map((k, idx) => (
          <button key={k} role="radio" aria-checked={filter === k}
            tabIndex={filter === k ? 0 : -1}
            className={"chip sm" + (filter === k ? " on" : "")}
            onClick={() => setFilter(k)}
            onKeyDown={(e) => handleChipKeyDown(e, idx)}>
            {FILTER_LABELS[k]}
          </button>
        ))}
      </div>
      <div className="notif-pop-list" role="list" aria-label="Lista de notificações">
        {list.length === 0
          ? renderEmpty()
          : groups.map((g, i) => g.single
              ? <NotifRow key={g.single.id} n={g.single} onAction={onAction} onToggleRead={onToggleRead} onDismiss={onDismiss} />
              : <NotifThread key={"t" + i} items={g.items} onAction={onAction} onToggleRead={onToggleRead} onDismiss={onDismiss} maxExpanded={3} goInbox={goInbox} />)}
      </div>
      {total > showing && (
        <a href="/cms/notifications" className="notif-pop-foot" onClick={(e) => { e.preventDefault(); goInbox(); }}>
          Ver todas as {total} notificações <Icon name="arrowright" size={14} />
        </a>
      )}
      {total <= showing && (
        <a href="/cms/notifications" className="notif-pop-foot" onClick={(e) => { e.preventDefault(); goInbox(); }}>
          Ver todas as notificações <Icon name="arrowright" size={14} />
        </a>
      )}
    </div>
  );
}

/* ---------- POPOVER SKELETON (loading fallback for next/dynamic) ---------- */
function SkelPopover() {
  return (
    <div className="notif-pop">
      <div className="notif-pop-head"><Skel h={16} w="120px" r={5} /><div className="grow" /><Skel h={28} w={80} r={7} /></div>
      <div className="notif-chips"><Skel h={26} w={52} r={7} /><Skel h={26} w={68} r={7} /><Skel h={26} w={60} r={7} /><Skel h={26} w={64} r={7} /></div>
      <div className="notif-pop-list">
        {[0,1,2,3].map(i => (
          <div key={i} className="row gap-12" style={{ padding: "13px 15px", borderBottom: "1px solid var(--border-soft)" }}>
            <Skel h={32} w={32} r={9} />
            <div className="grow col gap-6"><Skel h={13} w="55%" r={4} /><Skel h={12} w="80%" r={4} /><Skel h={11} w="30%" r={4} /></div>
          </div>
        ))}
      </div>
      <div className="notif-pop-foot" style={{ justifyContent: "center" }}><Skel h={13} w={160} r={4} /></div>
    </div>
  );
}

/* ---------- INBOX PAGE ---------- */
/* Reusable roving tabindex hook for radiogroup chips */
function useRovingRadio(keys, activeKey, setActiveKey, containerRef) {
  const handleKeyDown = useCallback((e, idx) => {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next = (idx + 1) % keys.length; }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); next = (idx - 1 + keys.length) % keys.length; }
    if (next >= 0) {
      setActiveKey(keys[next]);
      const chips = containerRef.current?.querySelectorAll('[role="radio"]');
      if (chips && chips[next]) chips[next].focus();
    }
  }, [keys, setActiveKey, containerRef]);
  return handleKeyDown;
}

function InboxView({ notifs, onAction, onToggleRead, onDismiss, markAll, goPrefs, state }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(new Set());
  const [cursor, setCursor] = useState(50); /* cursor-based pagination: show first 50, load more in increments */
  const listRef = useRef(null);
  const liveRef = useRef(null);
  const selLiveRef = useRef(null);
  const chipsRef = useRef(null);
  const prevSelSize = useRef(0);

  if (state === "loading") return <SkelInbox />;
  if (state === "empty") return <EmptyInbox />;

  const toggleSel = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filtered = notifs.filter(n =>
    (filter === "all" ? true : filter === "unread" ? !n.read : n.domain === filter) &&
    (q === "" || (n.title + n.msg).toLowerCase().includes(q.toLowerCase()))
  );

  /* Announce filter/search result changes to screen readers */
  useEffect(() => {
    if (liveRef.current) {
      if (filtered.length === 0) {
        liveRef.current.textContent = q ? `Nenhuma notificação encontrada para "${q}"` : "Nenhuma notificação encontrada";
      } else {
        liveRef.current.textContent = `Mostrando ${filtered.length} notificação${filtered.length > 1 ? "ões" : ""}`;
      }
    }
  }, [filter, filtered.length, q]);

  /* Announce selection changes via persistent live region */
  useEffect(() => {
    if (selLiveRef.current) {
      if (sel.size === 0 && prevSelSize.current > 0) {
        selLiveRef.current.textContent = "Seleção limpa";
      } else if (sel.size > 0) {
        selLiveRef.current.textContent = `${sel.size} notificação${sel.size > 1 ? "ões" : ""} selecionada${sel.size > 1 ? "s" : ""}`;
      }
      prevSelSize.current = sel.size;
    }
  }, [sel.size]);

  /* Focus management after bulk operations: move focus to first row */
  const focusFirstRow = useCallback(() => {
    requestAnimationFrame(() => {
      const firstRow = listRef.current?.querySelector('[role="listitem"]');
      if (firstRow && firstRow.focus) firstRow.focus();
    });
  }, []);

  const handleBulkMarkRead = () => {
    sel.forEach(id => onToggleRead(id, true));
    setSel(new Set());
    focusFirstRow();
  };
  const handleBulkDismiss = () => {
    /* In production: aggregate undo toast with 7s window before commit */
    sel.forEach(id => onDismiss(id));
    setSel(new Set());
    focusFirstRow();
  };
  const handleBulkCancel = () => {
    setSel(new Set());
    focusFirstRow();
  };

  // group by time bucket (calendar-day boundaries)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - (now.getDay() * 86400000);
  const buckets = { "Hoje": [], "Ontem": [], "Esta semana": [], "Mais antigos": [] };
  filtered.forEach(n => {
    const ts = now.getTime() - n.mins * 60000;
    const b = ts >= todayStart ? "Hoje" : ts >= yesterdayStart ? "Ontem" : ts >= weekStart ? "Esta semana" : "Mais antigos";
    buckets[b].push(n);
  });
  const counts = { all: notifs.length, unread: notifs.filter(n => !n.read).length };
  Object.keys(DOMAINS).forEach(d => counts[d] = notifs.filter(n => n.domain === d).length);
  const chipKeys = ["all","unread",...Object.keys(DOMAINS)];
  const tabs = [["all","Todas"],["unread","Não lidas"],...Object.entries(DOMAINS).map(([k,v]) => [k, v.label])];

  /* Roving tabindex for filter chips */
  const handleChipKeyDown = useRovingRadio(chipKeys, filter, setFilter, chipsRef);

  /* Pagination: determine if more items exist */
  const paginatedFiltered = filtered.slice(0, cursor);
  const hasMore = filtered.length > cursor;
  const remaining = filtered.length - cursor;

  const handleLoadMore = () => {
    const prevCursor = cursor;
    setCursor(c => c + 50);
    /* Focus first newly loaded item after render */
    requestAnimationFrame(() => {
      const rows = listRef.current?.querySelectorAll('[role="listitem"]');
      if (rows && rows[prevCursor]) rows[prevCursor].focus();
    });
  };

  /* Handle mark all with undo toast */
  const handleMarkAll = () => {
    markAll();
    pushToast({
      kind: "success", title: "Todas marcadas como lidas", icon: "checkcheck",
      actionLabel: "Desfazer", duration: 7000,
      onAction: () => { /* In production: revert via dispatch REVERT_MARK_ALL */ }
    });
  };

  return (
    <div className="fade-in" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Persistent live regions for screen reader announcements */}
      <div ref={liveRef} aria-live="polite" role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }} />
      <div ref={selLiveRef} aria-live="polite" role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }} />

      <div className="row between inbox-header" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="tb-title">Caixa de notificações</h1>
          <div className="tb-sub mt-4">{counts.unread} não lidas · {counts.all} no total</div>
        </div>
        <div className="row gap-8">
          <button className="btn primary" onClick={handleMarkAll} disabled={counts.unread === 0} aria-label="Marcar todas como lidas"><Icon name="checkcheck" size={15} /> Marcar todas lidas</button>
          <button className="btn ghost icon-btn bare" title="Preferências" aria-label="Preferências de notificação" onClick={goPrefs} style={{ minWidth: 44, minHeight: 44 }}><Icon name="settings" size={16} /></button>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div className="row gap-8 inbox-filters" ref={chipsRef} role="radiogroup" aria-label="Filtrar notificações">
          {tabs.map(([k, l], idx) => (
            <button key={k} role="radio" aria-checked={filter === k}
              tabIndex={filter === k ? 0 : -1}
              className={"chip" + (filter === k ? " on" : "")}
              onClick={() => setFilter(k)}
              onKeyDown={(e) => handleChipKeyDown(e, idx)}>
              {DOMAINS[k] && <span className="dot" style={{ width: 7, height: 7, borderRadius: 9, background: DOMAINS[k].color, display: "inline-block", marginRight: 6 }} />}
              {l} {counts[k] > 0 && <span className="dim" style={{ marginLeft: 4 }}>{counts[k]}</span>}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <div className="search-box" role="search" aria-label="Buscar notificações">
            <Icon name="search" size={15} />
            <input aria-label="Buscar notificações" placeholder="Buscar notificações…" value={q} onChange={e => setQ(e.target.value)} id="inbox-search" />
            {q && <button className="search-clear" onClick={() => setQ("")} aria-label="Limpar busca"><Icon name="x" size={14} /></button>}
          </div>
          {q && filtered.length > 0 && <div className="dim fs11 mt-4">{filtered.length} resultado{filtered.length > 1 ? "s" : ""} para "{q}"</div>}
        </div>
      </div>

      <div className="bulk-bar-wrapper" style={{ visibility: sel.size > 0 ? "visible" : "hidden", height: sel.size > 0 ? "auto" : 0, overflow: "hidden", marginBottom: sel.size > 0 ? 12 : 0, transition: "height .2s" }}>
        <div className="bulk-bar fade-in" role="toolbar" aria-label="Ações em lote">
          <span className="fw5">{sel.size} selecionada(s)</span>
          <div className="grow" />
          <button className="btn sm ghost" onClick={handleBulkMarkRead}><Icon name="check" size={14} /> Marcar lidas</button>
          <button className="btn sm ghost" onClick={handleBulkDismiss}><Icon name="archive" size={14} /> Dispensar</button>
          <button className="btn sm ghost" onClick={handleBulkCancel}>Cancelar</button>
        </div>
      </div>

      <Card>
        <div ref={listRef}>
        {filtered.length === 0 ? (
          <EmptyState icon="inbox" title="Nada por aqui" sub="Não há notificações que correspondam a este filtro." />
        ) : (
          Object.entries(buckets).map(([b, arr]) => arr.length === 0 ? null : (
            <div key={b} role="group" aria-labelledby={`bucket-${b.replace(/\s/g,'-')}`}>
              <h2 id={`bucket-${b.replace(/\s/g,'-')}`} className="bucket-label">{b}</h2>
              <div role="list" aria-label={`Notificações de ${b}`}>
              {groupList(arr).map((g, i) => g.single
                ? <NotifRow key={g.single.id} n={g.single} full selected={sel.has(g.single.id)} onSelect={toggleSel} onAction={onAction} onToggleRead={onToggleRead} onDismiss={onDismiss} />
                : <NotifThread key={"t" + i} items={g.items} full selected={sel} onSelect={toggleSel} onAction={onAction} onToggleRead={onToggleRead} onDismiss={onDismiss} />)}
              </div>
            </div>
          ))
        )}
        </div>
        {hasMore && (
          <button className="load-more-btn" onClick={handleLoadMore} aria-label={`Carregar mais ${Math.min(remaining, 50)} notificações`}>
            Carregar mais {Math.min(remaining, 50)} notificações <Icon name="arrowright" size={14} />
          </button>
        )}
      </Card>
    </div>
  );
}

/* ---------- PREFERENCES PAGE ---------- */
const PRESETS = {
  calm:    { label: "Calmo",   sub: "Essencial", desc: "Só alertas críticos: falhas de publicação, tokens expirados. Resto num resumo diário." },
  regular: { label: "Regular", sub: "Equilibrado",  desc: "A/B tests, metas atingidas, avisos de pipeline em tempo real. Métricas menores no resumo." },
  power:   { label: "Power",   sub: "Tudo",         desc: "Tudo em tempo real, incluindo cada clique e digest completo." },
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
          <h1 className="tb-title">Preferências de notificação</h1>
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
              <span role="switch" aria-checked={channels[k]} aria-label={`${l} ativo`} className={"switch" + (channels[k] ? " on" : "")} tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setChannels(c => ({ ...c, [k]: !c[k] })); } }}><i /></span>
            </button>
          ))}
        </div>
      </Card>

      {/* presets */}
      <Card className="mt-16"><CardHead icon="gauge" title="Frequência" />
        <div className="card-pad grid g-cols-3 g-cols-1-sm" style={{ gap: 12 }} role="radiogroup" aria-label="Frequência de notificações">
          {Object.entries(PRESETS).map(([k, p]) => (
            <button key={k} role="radio" aria-checked={preset === k} className={"preset" + (preset === k ? " on" : "")} onClick={() => setPreset(k)}>
              <div className="row between"><span className="fw6">{p.label}</span>
                <span className={"radio" + (preset === k ? " on" : "")} aria-hidden="true" />
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
              <button className="cat-head" onClick={() => setOpen(open === dom ? null : dom)}
                aria-expanded={open === dom} aria-controls={`cat-body-${dom}`}>
                <span className="cat-ico" style={{ background: dm.soft, color: dm.color }}><Icon name={dm.icon} size={15} /></span>
                <span className="fw5 fs13">{dm.label}</span>
                {dom === "system" && <span className="badge" style={{ marginLeft: 8 }}><Icon name="info" size={11} /> Obrigatório</span>}
                <div className="grow" />
                <span className="dim fs12">{CHANNELS.filter(([c]) => cats[dom][c]).length} canais</span>
                <Icon name="chevrond" size={16} style={{ transform: open === dom ? "rotate(180deg)" : "none", transition: ".2s", color: "var(--text-dim)" }} />
              </button>
              {open === dom && (
                <div id={`cat-body-${dom}`} className="cat-body fade-in">
                  {CHANNELS.map(([ch, cl, ci]) => {
                    const required = dom === "system" && ch === "in_app";
                    const globalOff = !channels[ch];
                    const isOn = cats[dom][ch] || required;
                    const disabled = required || globalOff;
                    return (
                      <div key={ch} className="cat-row" style={globalOff ? { opacity: 0.4 } : undefined}
                        title={globalOff ? `Canal ${cl} desativado globalmente` : undefined}>
                        <Icon name={ci} size={14} style={{ color: "var(--text-dim)" }} />
                        <span className="fs13">{cl}</span>
                        <div className="grow" />
                        <button role="switch" aria-checked={isOn} aria-disabled={disabled}
                          aria-label={`${cl} para ${dm.label}`}
                          tabIndex={disabled ? -1 : 0}
                          className={"switch" + (isOn ? " on" : "") + (disabled ? " locked" : "")}
                          onClick={() => !disabled && setCat(dom, ch)}
                          onKeyDown={(e) => { if (!disabled && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setCat(dom, ch); } }}><i /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* quiet hours — production: add time pickers and timezone selector */}
      <Card className="mt-16"><CardHead icon="moon" title="Horário de silêncio" />
        <div className="card-pad row between">
          <div>
            <div className="fs13 fw5">Pausar não-críticas das 22h às 8h</div>
            <div className="dim fs12 mt-4">Só alertas críticos (falhas, tokens) passam nesse período.</div>
            <div className="dim fs11 mt-4">Fuso: {Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
          </div>
          <button role="switch" aria-checked={quiet} aria-label="Horário de silêncio ativo"
            className={"switch" + (quiet ? " on" : "")} tabIndex={0}
            onClick={() => setQuiet(q => !q)}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setQuiet(q => !q); } }}><i /></button>
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

Object.assign(window, { NotifRow, NotifPopover, SkelPopover, InboxView, PrefsView, ToastHost, pushToast });
