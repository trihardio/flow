<!-- made by a script from src/App.jsx (the whole app is that one file): line numbers are as of the day it was made -->
# Shared layout

There is no router and no page shell component. A screen is the page background (one dark SVG gradient on `body`), a menu button fixed top-left that opens the sidebar (`SideNav`), the content column (max about 1216px, centred), and a footer row of icon buttons with the crocodile logo at its right end. Pop-ups are glass panels over a dimmed, blurred backdrop.

### SideNav
- File: `src/App.jsx` lines 3163–3250

```jsx
const SideNav = memo(({ api, rows, act, spy, spyKey, hidden, foot }) => {
  const [open, setOpen] = useState(false);          // always shut until the three lines are pressed
  const [at, setAt] = useState(null);
  useLayoutEffect(() => { document.body.classList.add("has-side"); return () => document.body.classList.remove("has-side"); }, []);
  // which part is on the line two fifths down the window: read once a frame while the page scrolls, and written only
  // when it changes. The parts are looked up again whenever one has left the page: a card puts its content there
  // afresh the first time it is seen and every time it is unfolded, the Debts section with it
  useEffect(() => {
    setAt(null);
    if (!open || !spyKey || !spy) return;
    const els = {}, missAt = {};      // a part not on the page is looked for again at most every 300ms
    let raf = 0;
    const read = () => {
      raf = 0;
      const line = window.innerHeight * 0.4;
      let hit = null;
      for (const id of spy) {
        let el = els[id] && els[id].isConnected ? els[id] : null;
        if (!el) {
          const t = performance.now();
          if (missAt[id] && t - missAt[id] < 300) continue;
          el = els[id] = (warm.page || document).querySelector(SIDE_PARTS[id]);
          if (el) delete missAt[id]; else missAt[id] = t;
        }
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) hit = id;
      }
      setAt(hit);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    window.addEventListener("scroll", onScroll, { passive: true });
    read();
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [spyKey, open]);
  // Esc shuts it, and goes no further (the panels behind have Esc steps of their own)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); setOpen(false); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);
  useEffect(() => { if (hidden) setOpen(false); }, [hidden]);
  // a row pressed does its thing and the panel shuts behind it
  const go = (id) => { setOpen(false); api.current.go(id); };
  const tab = open ? 0 : -1;
  let k = 0;      // each line's place in the list, for its turn to come in
  const line = (key, cls, kid) => <div key={key} className={`sd-in${cls ? ` ${cls}` : ""}`} style={{ "--i": k++ }}>{kid}</div>;
  return createPortal(
    <div className={`snav-root${open ? " open" : ""}${hidden ? " off" : ""}`}>
      <div className="snav-scrim" onClick={() => setOpen(false)} />
      <nav className="snav" aria-label="Sections" aria-hidden={!open}>
        {line("name", "snav-name", "FLOW")}
        {/* the button on top; the trading sides have two (the quick log, then the calculator) */}
        {(Array.isArray(act) ? act : [act]).map((a) => line(`act-${a.id}`, "", (
          <button className="sd-act" tabIndex={tab} onClick={() => go(a.id)} title={a.tip}>
            <span className="msym">{a.icon}</span><span className="sd-t">{a.text}</span>{a.key && <kbd>{a.key}</kbd>}
          </button>
        )))}
        {rows.map((r, i) => r.head ? line(`h${i}`, "", <div className="sd-head">{r.head}</div>) : line(r.id, "", (
          <button className={`sd-row${r.sub ? " sub" : ""}${r.on ? " on" : ""}${at === r.id ? " at" : ""}`} tabIndex={tab} onClick={() => go(r.id)} title={r.tip || r.text}>
            {r.pic !== undefined ? <span className={`sd-pic${r.dev ? " dev" : ""}`}><Avatar pic={r.pic} img={r.img} bg={r.bg} bgImg={r.bgImg} /></span> : <span className="msym">{r.icon}</span>}<span className="sd-t">{r.text}</span>{r.tail != null && <i>{r.tail}</i>}
          </button>
        )))}
        <div className="sd-gap" />
        {/* the crocodile says how today stands: a green mark when it is going well, a drop of sweat when it is not */}
        {foot && line("foot", "", (
          <button className="sd-foot" tabIndex={tab} onClick={() => go("home")} title="Back to home">
            <span className="sd-croc"><CrocLogo />{foot.mood === "bad" ? <i key="bad" className="sd-drop" /> : foot.mood === "good" ? <i key="good" className="sd-ok" /> : null}</span>
            <span className="sd-say sd-t"><b style={{ color: foot.ink }}>{foot.text}</b><small>{foot.sub}</small></span>
          </button>
        ))}
      </nav>
      {/* the three lines: they turn into a cross while the panel is open, and back */}
      <button className="snav-burger" onClick={() => setOpen((v) => !v)} title={open ? "Close the menu (Esc)" : "Menu"} aria-label="Menu" aria-expanded={open}><i /><i /><i /></button>
    </div>, document.body);
}, sameSideProps);

/* Debts, a section of the Goals card: what he owes ("owe") and what others owe him ("owed"), each with how much of it
   has been paid back. Rows are the goals' own rows (name, paid / total, bar, a + that opens the amount box).
   It keeps what is typed to itself, so a keystroke re-renders this section and nothing behind it.
   api.current: { save(next list), fmt, fmtLive, toIDR(amount as typed) }. */
const cleanDebts = (list) => (Array.isArray(list) ? list : [])
  .filter((d) => d && typeof d === "object" && d.id && typeof d.name === "string" && Number(d.amount) > 0)
  .map((d) => {
    const amount = Math.min(Number(d.amount), MAX_AMOUNT);
    return { id: d.id, name: d.name.slice(0, 60), amount, paid: Math.min(amount, Math.max(0, Number(d.paid) || 0)), dir: d.dir === "owed" ? "owed" : "owe", ...(d.test && { test: true }) };
  });
```

### SettingsPop
- File: `src/App.jsx` lines 5253–5287

```jsx
const SettingsPop = ({ onClose, children }) => {
  const [closing, setClosing] = useState(false);
  const dev = useDevOpt();
  const shut = useRef(null);
  shut.current = () => { if (closing) return; setClosing(true); setTimeout(onClose, 190); };
  useEffect(() => {
    const onKey = (e) => { e.stopImmediatePropagation(); if (e.key === "Escape") shut.current(); };
    const onWheel = (e) => e.stopImmediatePropagation();
    window.addEventListener("keydown", onKey, true); window.addEventListener("wheel", onWheel, true);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("wheel", onWheel, true); };
  }, []);
  return (
    <div style={{ ...S.backdrop, animation: closing ? "fadeOut .19s ease both" : "fadeIn .2s ease backwards" }} onClick={() => shut.current()}>
      <div role="dialog" aria-modal="true" aria-label="Settings" className="glass set-modal" style={{ animation: closing ? "modalPopOut .24s var(--ease-soft) both" : "modalPop .4s var(--ease) backwards" }} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <span style={S.panelTitle}>Settings</span>
          <button className="x-btn" style={S.closeBtn} onClick={() => shut.current()}>✕</button>
        </div>
        {children}
        {window.flowBackup && (
          <div className="set-row">
            <span className="set-k"><b>Automatic backup</b><small>{autoSaid()}</small></span>
          </div>
        )}
        <div className="set-row">
          <span className="set-k"><b>Developer options</b><small>Add and clear test data, Test levels in the calculators, Reset account</small></span>
          <span className="wr-seg">
            <button className={dev ? "on" : ""} onClick={() => setDevOpt(true)}>On</button>
            <button className={dev ? "" : "on"} onClick={() => setDevOpt(false)}>Off</button>
          </span>
        </div>
      </div>
    </div>
  );
};
```

### QuickLog
- File: `src/App.jsx` lines 2925–3014

```jsx
const QuickLog = memo(({ api, cur, isMYR, onClose, plain }) => {
  const [text, setText] = useState("");
  const [incOn, setIncOn] = useState(false);          // Tab: income, whatever the line says
  const [done, setDone] = useState(null);             // the last thing added: { id, inc, text }
  const [closing, setClosing] = useState(false);
  const boxRef = useRef(null), inRef = useRef(null), shut = useRef(null);
  shut.current = () => { if (closing) return; setClosing(true); setTimeout(onClose, 190); };
  // while it is open no key and no wheel reaches the panels behind (as with the settings pop-up)
  useEffect(() => {
    const onKey = (e) => {
      if (boxRef.current?.contains(e.target)) return;
      e.stopImmediatePropagation();
      if (e.key === "Escape") shut.current(); else inRef.current?.focus();
    };
    const onWheel = (e) => e.stopImmediatePropagation();
    window.addEventListener("keydown", onKey, true); window.addEventListener("wheel", onWheel, true);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("wheel", onWheel, true); };
  }, []);
  const { fmt, toIDR } = api.current;
  const often = useMemo(() => api.current.often(), [done]);      // counted again after each add
  const p = parseQuick(text, isMYR);
  const inc = incOn || p.inc, idr = p.amount ? toIDR(String(p.amount)) : 0;
  const cat = !inc && p.desc ? inferCat(p.desc) : null;
  const day = api.current.today(), left = day.limit - day.spent;
  const put = (kind, amount, desc, back) => {
    const shown = api.current.put(kind, amount, desc, back);
    inRef.current?.focus();
    if (!shown) return;
    setText(""); setIncOn(false);
    setDone({ id: Date.now(), inc: kind === "inc", text: `${kind === "inc" ? "+" : "−"}${shown}${desc ? ` ${desc}` : ""}${back ? " · yesterday" : ""}` });
  };
  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") { shut.current(); return; }
    if (e.key === "Tab") { e.preventDefault(); setIncOn((v) => !v); return; }
    if (e.metaKey && /^[1-6]$/.test(e.key)) { e.preventDefault(); const o = often[e.key - 1]; if (o) put("exp", o.amount, o.desc, 0); return; }
    if (e.key !== "Enter") return;
    if (!text.trim()) { shut.current(); return; }
    if (idr) put(inc ? "inc" : "exp", idr, p.desc, p.back);
  };
  return (
    <div style={{ ...S.backdrop, zIndex: 80, alignItems: "flex-start", animation: closing ? "fadeOut .2s ease both" : "fadeIn .2s ease backwards", ...(plain ? QL_PLAIN : null) }} onClick={() => shut.current()}>
      <div role="dialog" aria-modal="true" aria-label="Quick log" ref={boxRef} className={`ql glass${closing ? " out" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="ql-line">
          <button className={`ql-kind${inc ? " inc" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setIncOn((v) => !v)}
                  title="Tab switches between expense and income"><i />{inc ? "Income" : "Expense"}</button>
          <input ref={inRef} autoFocus className="ql-in" value={text} spellCheck={false} aria-label="What to add to today"
                 placeholder={isMYR ? "coffee 12.5 · +3k salary" : "kopi 25 · 1,5jt sewa · +5jt gaji"}
                 onChange={(e) => setText(e.target.value.slice(0, 120))} onKeyDown={onKey} />
        </div>
        <div className="ql-read">
          {!text.trim() ? <span>Type what it was and how much, then Enter.{isMYR ? "" : " A bare number is thousands: 25 is 25Rb."}</span>
            : !idr ? <span>No amount yet{p.desc ? <> · <b>{p.desc}</b></> : ""}</span>
            : <>
                <b style={{ color: inc ? "#3ddc97" : "#ff8d97" }}>{inc ? "+" : "−"}{fmt(idr)}</b>
                {p.desc && <><i>·</i><b>{p.desc}</b></>}
                {cat && <><i>·</i><span className="ql-cat"><span className="msym">{CATS[cat].icon}</span>{CATS[cat].label}</span></>}
                <i>·</i><span>{p.back ? "Yesterday" : "Today"}</span>
                <kbd>Enter</kbd>
              </>}
        </div>
        {often.length > 0 && (
          <div className="ql-often">
            <span>Often</span>
            {often.map((o, i) => (
              <button key={o.desc} className="ql-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => put("exp", o.amount, o.desc, 0)}
                      title={`Add ${o.desc} to today (⌘${i + 1})`}>{o.desc}<b>{fmt(o.amount)}</b></button>
            ))}
          </div>
        )}
        <div className="ql-foot">
          <span>Today <b>{fmt(day.spent)}</b> of {fmt(day.limit)}{" · "}
            <b style={{ color: left >= 0 ? "#8fd7a4" : "#ff8d97" }}>{left >= 0 ? `${fmt(left)} left` : `${fmt(-left)} over`}</b></span>
          {done ? <span key={done.id} className={`ql-done${done.inc ? " inc" : ""}`}><span className="msym">check</span>{done.text}</span>
            : <span className="ql-hint">Tab income · Esc close</span>}
        </div>
      </div>
    </div>
  );
});

/* The quick log on the trading sides (8 October 2026: the finance side's, in a trader's words). ⌘N anywhere on a
   trading side, or the button on top of its sidebar: one line, read as it is typed, Enter adds the trade to today.
   A line may hold, in any order: the name, what it made (a minus is a loss), "long" / "short" (forex also "buy" /
   "sell"), "be" for break-even, "yesterday" / "kemarin". "btc 120" · "eth -45 short" · "be sol" · "kemarin antm 350".
   Tab turns a win into a loss and back. Amounts are in the currency the side keeps its trades in: dollars as typed,
   rupiah as on the finance side (a bare number under 1000 is thousands; rb and jt say so outright).
   The names he trades most are one press each under the line: with an amount typed the press adds the trade, without
   one it writes the name. */
const QUICK_SIDES = { long: "long", buy: "long", short: "short", sell: "short" };
```
