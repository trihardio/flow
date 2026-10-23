<!-- made by a script from src/App.jsx (the whole app is that one file): line numbers are as of the day it was made -->
# Shared UI primitives

Framework: React 18 (Vite), no component library, no Tailwind. Every component lives in `src/App.jsx`; styles are one stylesheet inside that file (lines 13588–16838) plus an inline-style table `S`. Icons: Material Symbols Outlined (`<span className="msym">name</span>`).

### FoldCard
- File: `src/App.jsx` lines 6641–6712

```jsx
const FoldCard = ({ title, sub, runKey, name, style, loose, parts, children }) => {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  const [open, setOpen] = useState(true);
  const [closing, setClosing] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } });
    }, { threshold: 0.18 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-mv="" data-card={name} className={`flow-card glass${seen ? " shown" : ""}`} style={{ ...S.flowCard, ...style, "--tint": CARD_TINT[name] || "#9aa3ab" }}>
      <div className="card-aura" />
      <div style={S.flowHead}>
        <span className="card-tag"><i />{title}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={S.flowSub}>{sub}</span>
          <button className={`plain-arrow chev${open ? " up" : ""}`} style={S.plainArrow}
                  onClick={() => {
                    if (open) { setClosing(true); setTimeout(() => { setOpen(false); setClosing(false); }, 300); }
                    else { setOpen(true); setRun((n) => n + 1); }
                  }}
                  title={open ? `Hide ${name}` : `Show ${name}`}><Chevron /></button>
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateRows: open && !closing ? "1fr" : "0fr", transition: "grid-template-rows .34s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={loose ? S.foldLoose : S.fold}>
          <div key={`${run}-${parts || seen}-${runKey}`} className="fold-in"
               style={{ opacity: closing ? 0 : 1, transform: closing ? "translateY(-14px)" : "translateY(0)",
                        transition: "opacity .26s ease, transform .3s cubic-bezier(0.4,0,0.2,1)" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

/* a pair box: the coin as typed, with USDT.P written after it in grey (not when the quote is already typed: BTCUSDT,
   BTC/USDT). A stock's box has nothing written after it. `tail` is more grey text, at the right end of the box */
const PairBox = ({ value, wrap, pad, ghost, tail, ...input }) => (
  <span style={{ position: "relative", display: "block", ...wrap }}>
    <input value={value} {...input} />
    {ghost && value && !value.includes("/") && coinOf(value) === value && (
      <span className="pair-ghost" style={{ padding: `0 ${pad}px` }} aria-hidden="true"><i>{value}</i><b>{ghost}</b></span>
    )}
    {tail && <span className="pair-tail" style={{ right: pad }} aria-hidden="true">{tail}</span>}
  </span>
);

/* the long / short switch on a trade */
const SideChip = ({ side, onToggle, big }) => (
  <button className={`side-chip${side === "short" ? " short" : ""}${big ? " big" : ""}`} onClick={onToggle}
          title={side === "short" ? "Short · click for long" : "Long · click for short"}>
    <span className="msym">trending_up</span>{side === "short" ? "Short" : "Long"}
  </button>
);

/* ---------- pictures on a trade (crypto journal) ----------
   A picture is made small before it is kept: at most SHOT_EDGE px on its long side, as WebP, which brings a chart
   screenshot from megabytes down to some 40–150 KB. Pictures live in IndexedDB "flow-shots", apart from the trades:
   a trade only holds their ids (imgs), so the saved trades stay small and typing in a box rewrites no picture.
   They go into the backup with the trades. A picture no trade points to any more is removed the next time the
   crypto side is opened, never at once (an import can be undone, and the trade would come back without it).
   Test data has pictures at no cost: the id "ph:<number>" is a made-up chart, drawn on the spot from that number.
   Only the crypto side keeps pictures: if the stocks side ever does, shotSweep must be told about its trades too. */
const SHOT_EDGE = 1600, SHOT_Q = 0.8;
```

### SecHead
- File: `src/App.jsx` lines 3287–3524

```jsx
const SecHead = ({ icon, title, children }) => (
  <div className="sec-head">
    <span className="msym">{icon}</span>
    <span className="sec-t">{title}</span>
    {children != null && children !== false && <span className="sec-r">{children}</span>}
  </div>
);

const WeekPlans = memo(({ plans, api, cur, isMYR, tick, week }) => {
  const days = useMemo(() => planDays(new Date(), week), [tick, week]);
  const [amt, setAmt] = useState("");
  const [desc, setDesc] = useState("");
  const [on, setOn] = useState(null);
  const [gone, setGone] = useState({});
  const today = dayKeyOf(new Date()), last = days[days.length - 1].key;
  const day = days.some((d) => d.key === on) ? on : ((days[0].key === today && days[1]) || days[0]).key;
  const list = plans.filter((x) => x.date >= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const add = () => {
    const amount = api.current.toIDR(amt);
    if (!amount) return;
    api.current.add({ id: uid(), amount, desc: desc.trim(), date: day });
    setAmt(""); setDesc("");
  };
  // a row folds away first, then the plan goes (or is filed)
  const out = (id, how) => {
    if (gone[id]) return;
    setGone((g) => ({ ...g, [id]: true }));
    setTimeout(() => { api.current[how](id); setGone((g) => { const c = { ...g }; delete c[id]; return c; }); }, 260);
  };
  const said = (key) => {
    if (key === today) return "Today";
    const d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8)));
    return `${DOW_FULL[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  };
  return (
    <div className="wp">
      <SecHead icon="schedule" title="Planned">{list.length > 0 && `${api.current.fmt(list.reduce((a, x) => a + x.amount, 0))} to come`}</SecHead>
      <div style={{ ...S.addRow, marginBottom: 8 }}>
        <AmountField value={amt} setValue={setAmt} accent="red" cur={cur} ghost={api.current.ghost(amt)} allowDecimal={isMYR} onSubmit={add} />
        <input className="desc-field" style={{ ...S.darkInput, flex: 1, minWidth: 160 }} placeholder="What for, e.g. haircut, dinner out"
               value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="split-btn" title="Add to the plan" aria-label="Add to the plan" onClick={add}><span className="msym" style={{ fontSize: 20 }}>add</span></button>
      </div>
      <div className="wp-pick" aria-label="The day it is planned for">
        <i>On</i>
        <span className="wp-days" style={{ "--at": Math.max(0, days.findIndex((d) => d.key === day)) }}>
          <span className="wp-on" />
          {days.map((d) => <button key={d.key} className={d.key === day ? "on" : ""} title={d.tip} onClick={() => setOn(d.key)}>{d.label}</button>)}
        </span>
      </div>
      {list.length > 0 && (
        <div style={{ ...S.expList, marginTop: 12 }}>
          {list.map((x) => (
            <div key={x.id} className={`row-wrap${gone[x.id] ? " collapsing gone" : ""}`}>
              <div style={S.fold}>
                <div className="wp-row glass-soft" style={{ animation: "fadeDown .25s ease backwards" }}>
                  <span className="wp-day">{said(x.date)}{x.date > last ? " · later" : ""}</span>
                  <span className="wp-name">{x.desc || "Planned expense"}</span>
                  <b className="wp-amt">{api.current.fmt(x.amount)}</b>
                  <button className="wp-do" title="Done: add it to today's expenses" aria-label="Done: add it to today's expenses" onClick={() => out(x.id, "log")}><span className="msym">check</span></button>
                  <button className="trash-btn" style={S.delBtn} title="Remove from the plan" onClick={() => out(x.id, "remove")}><TrashIcon /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const Debts = memo(({ debts, api, cur, isMYR }) => {
  const [adding, setAdding] = useState(false);
  const [dir, setDir] = useState("owe");
  const [name, setName] = useState("");
  const [amt, setAmt] = useState("");
  const [payId, setPayId] = useState(null);         // the debt whose payment box is open
  const [payAmt, setPayAmt] = useState("");
  const [edit, setEdit] = useState(null);           // the debt being edited: { id, name, amt (as typed), was (amt as it stood), dir }
  const [leaving, setLeaving] = useState(null);
  const { fmt, fmtLive, toIDR, typed, save } = api.current;
  const ghostOf = (v) => !isMYR && digitsOf(v).length > 0 && digitsOf(v).length < 4;
  const add = () => {
    const who = name.trim(), amount = toIDR(amt);
    if (!who || !amount) return;
    save([...debts, { id: uid(), name: who, amount, paid: 0, dir }]);
    setName(""); setAmt(""); setAdding(false);
  };
  const pay = (id, sign) => {
    const by = toIDR(payAmt);
    if (!by) return;
    save(debts.map((d) => (d.id === id ? { ...d, paid: Math.min(d.amount, Math.max(0, d.paid + sign * by)) } : d)));
    setPayAmt("");
  };
  const remove = (id) => {
    setLeaving(id);
    setTimeout(() => {
      const was = api.current.list(), at = was.findIndex((d) => d.id === id), gone = was[at];
      save(was.filter((d) => d.id !== id)); setLeaving(null); setPayId((p) => (p === id ? null : p)); setEdit((e) => (e && e.id === id ? null : e));
      if (gone) offerUndo(gone.name || "debt", () => api.current.save(backInto(api.current.list(), gone, at)));
    }, 260);
  };
  // edit: the name, the amount and whose debt it is. An amount left as it stood is kept to the rupiah (in MYR the box
  // only shows it rounded); what was paid never comes to more than the new amount
  const openEdit = (d) => { const amt = typed(d.amount); setEdit(edit && edit.id === d.id ? null : { id: d.id, name: d.name, amt, was: amt, dir: d.dir }); setPayId(null); };
  const saveEdit = () => {
    const who = edit.name.trim(), amount = edit.amt === edit.was ? null : toIDR(edit.amt);
    if (!who || amount === 0) return;
    save(debts.map((d) => (d.id !== edit.id ? d : { ...d, name: who.slice(0, 60), amount: amount || d.amount, paid: Math.min(d.paid, amount || d.amount), dir: edit.dir })));
    setEdit(null);
  };
  const left = (kind) => debts.filter((d) => d.dir === kind).reduce((a, d) => a + d.amount - d.paid, 0);
  const kindNow = DEBT_KINDS.find((k) => k.dir === dir);
  return (
    <div className="debt-sec">
      <SecHead icon="handshake" title="Debts">
        {debts.length > 0 && <>I owe <b style={{ color: "#e2808c" }}>{fmt(left("owe"))}</b>{" · "}owed to me <b style={{ color: "#8fd7a4" }}>{fmt(left("owed"))}</b></>}
      </SecHead>
      {debts.length === 0 && !adding && <div style={S.insEmpty}>No debts. Add what you owe someone, or what someone owes you.</div>}
      {DEBT_KINDS.map((k) => {
        const list = debts.filter((d) => d.dir === k.dir);
        return list.length === 0 ? null : (
          <div key={k.dir}>
            <div className="debt-group"><i style={{ background: k.tone }} />{k.label}</div>
            {list.map((d, i) => {
              const pct = (d.paid / d.amount) * 100, done = d.paid >= d.amount, open = payId === d.id, ed = edit && edit.id === d.id ? edit : null;
              return (
                <div key={d.id} className={`goal-row debt-row${leaving === d.id ? " leaving" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
                  <div style={S.goalTop}>
                    <span style={{ ...S.goalName, display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span className="msym" style={{ fontSize: 19, color: done ? "#8fd7a4" : k.tone }}>{k.icon}</span>
                      <span className={`debt-name${done ? " done" : ""}`}>{d.name}</span>
                      {done && <span className="msym" style={{ fontSize: 15, color: "#e6c877", marginLeft: -2 }}>check_circle</span>}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={S.goalAmt}>
                        <CountNum value={d.paid} duration={600} render={fmtLive} />
                        <span style={{ color: "#8e969e" }}> / {fmt(d.amount)}</span>
                      </span>
                      <button className="goal-icon-btn" title={open ? "Close" : "Record a payment"} onClick={() => { setPayId(open ? null : d.id); setPayAmt(""); setEdit(null); }}>
                        <span className="msym" style={{ fontSize: 18, transform: open ? "rotate(45deg)" : "none", transition: "transform .3s cubic-bezier(0.34,1.3,0.64,1)" }}>add</span>
                      </button>
                      <button className={`goal-icon-btn${ed ? " on" : ""}`} title={ed ? "Close" : "Edit this debt"} onClick={() => openEdit(d)}>
                        <span className="msym" style={{ fontSize: 17 }}>{ed ? "close" : "edit"}</span>
                      </button>
                    </span>
                  </div>
                  <div style={S.goalBarRow}>
                    <GoalBar pct={pct} done={done} delay={120 + i * 60} />
                    <span style={{ ...S.goalPct, color: done ? "#8fd7a4" : "#c7cdd2" }}>
                      <CountNum value={Math.floor(pct)} duration={600} render={(n) => `${Math.round(n)}%`} />
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .3s cubic-bezier(0.4,0,0.2,1)" }}>
                    <div style={S.fold}>
                      <div style={{ ...S.goalFundRow, opacity: open ? 1 : 0, transition: "opacity .24s ease" }}>
                        <AmountField value={open ? payAmt : ""} setValue={setPayAmt} accent="green" cur={cur} width={150}
                                     ghost={open && ghostOf(payAmt)} allowDecimal={isMYR} onSubmit={() => pay(d.id, 1)} />
                        <button className="goal-io in" title={k.pay} onClick={() => pay(d.id, 1)}><span className="msym">download</span></button>
                        <button className="goal-io out" title={k.unpay} onClick={() => pay(d.id, -1)}><span className="msym">upload</span></button>
                        <span style={S.goalNote}>{done ? "Settled" : `${fmt(d.amount - d.paid)} left`}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateRows: ed ? "1fr" : "0fr", transition: "grid-template-rows .3s cubic-bezier(0.4,0,0.2,1)" }}>
                    <div style={S.fold}>
                      {ed && (
                        <div style={{ ...S.goalFundRow, animation: "fadeIn .24s ease backwards" }}>
                          <SlideSeg cls="debt-seg" style={{ "--owe": ed.dir === "owe" ? 1 : 0 }} value={ed.dir} onPick={(v) => setEdit((e) => (e ? { ...e, dir: v } : e))} options={DEBT_OPTS} />
                          <input style={{ ...S.darkInput, width: 190 }} value={ed.name} aria-label="Name" autoFocus
                                 onChange={(e) => setEdit({ ...ed, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEdit(null); }} />
                          <AmountField value={ed.amt} setValue={(v) => setEdit((e) => (e ? { ...e, amt: typeof v === "function" ? v(e.amt) : v } : e))} accent={ed.dir === "owe" ? "red" : "green"} cur={cur} width={150}
                                       ghost={ghostOf(ed.amt)} allowDecimal={isMYR} onSubmit={saveEdit} />
                          <button className="goal-save" onClick={saveEdit} title="Save changes" aria-label="Save changes"><span className="msym" style={{ fontSize: 22 }}>check</span></button>
                          <button className="trash-btn" style={{ ...S.delBtn, marginLeft: "auto" }} title="Delete this debt" onClick={() => remove(d.id)}><TrashIcon /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{ display: "grid", gridTemplateRows: adding ? "1fr" : "0fr", transition: "grid-template-rows .32s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={S.fold}>
          <div style={{ ...S.goalFundRow, paddingTop: 12, opacity: adding ? 1 : 0, transition: "opacity .24s ease" }}>
            {/* the box slides from one side to the other and goes from a red wash to a green one on the way */}
            <SlideSeg cls="debt-seg" style={{ "--owe": dir === "owe" ? 1 : 0 }} value={dir} onPick={setDir} options={DEBT_OPTS} />
            <input style={{ ...S.darkInput, width: 190 }} placeholder={kindNow.who} value={name}
                   onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
            <AmountField value={amt} setValue={setAmt} accent={dir === "owe" ? "red" : "green"} cur={cur} width={150}
                         ghost={ghostOf(amt)} allowDecimal={isMYR} onSubmit={add} />
            <button className="goal-save" onClick={add} title="Save debt" aria-label="Save debt"><span className="msym" style={{ fontSize: 22 }}>check</span></button>
          </div>
        </div>
      </div>
      <button className="goal-new" onClick={() => setAdding((v) => !v)}>
        <span className="msym" style={{ fontSize: 17, transform: adding ? "rotate(45deg)" : "none", transition: "transform .3s cubic-bezier(0.34,1.3,0.64,1)" }}>add</span>
        {adding ? "Cancel" : "New debt"}
      </button>
    </div>
  );
});

/* top-10 list used in the wrapped detail panel (module level so hover re-renders don't replay it) */
const WrList = ({ rows, color, emptyText, dkey }) => rows.length === 0 ? <div style={S.insEmpty}>{emptyText}</div> : (
  <div className="wr-list">
    {rows.map((row, k) => (
      <div key={`${dkey}-${k}-${row.label}`} className="wr-li" style={{ animationDelay: `${40 + k * 35}ms` }}>
        <span className="wr-li-rank">{k + 1}</span>
        <span className="wr-li-main">
          <span className="wr-li-name">{row.label}</span>
          <span className="wr-li-track"><span className="wr-li-fill" style={{ width: `${Math.max(2, row.frac * 100)}%`, background: row.color || color, animationDelay: `${120 + k * 35}ms` }} /></span>
        </span>
        <span className="wr-li-val">
          <span style={{ color: row.valColor || "#e8eaec" }}>{row.value}</span>
          {row.sub && <span className="wr-li-sub">{row.sub}</span>}
        </span>
      </div>
    ))}
  </div>
);

/* ---------- test data: the generator ----------
   What "Add test data" makes, one month at a time. Pure: the same settings and the same random source give the same
   entries. tools/projection-test.mjs reads this block out of the file to make the months it backtests on.
   Amounts in thousands of rupiah. small / mid: [% of spending days that have one, least, most]. big: [fewest a
   month, most a month, least, most]. weekend: what a Saturday or Sunday costs against a weekday. spike: % of days
   that cost 3–6 times as much. swing: how far a whole month may sit above or below the usual, in %. */
const SPEND_STYLES = {
  balanced: { label: "Balanced", small: [88, 10, 50], mid: [20, 50, 150], big: [2, 3, 300, 500], weekend: 1, spike: 0, swing: 0 },
  frugal:   { label: "Frugal", small: [62, 5, 30], mid: [7, 40, 90], big: [0, 1, 200, 350], weekend: 1, spike: 0, swing: 0 },
  erratic:  { label: "Erratic", small: [70, 5, 90], mid: [30, 60, 260], big: [3, 6, 250, 900], weekend: 1, spike: 8, swing: 60 },
  big:      { label: "Big spender", small: [96, 30, 90], mid: [45, 100, 300], big: [4, 6, 400, 1200], weekend: 1, spike: 0, swing: 0 },
  weekend:  { label: "Weekend splurger", small: [80, 8, 35], mid: [25, 50, 120], big: [1, 2, 300, 600], weekend: 3.2, spike: 0, swing: 0 },
};
```

### InfoTip
- File: `src/App.jsx` lines 1586–1596

```jsx
const InfoTip = ({ title, children }) => (
  <button type="button" className="info-btn" aria-label={title}>
    <span className="msym">info</span>
    <span className="info-tip" role="tooltip"><b>{title}</b>{children}</span>
  </button>
);

/* A name on a card always fits: how wide it would run in its own font (in ems, the letter-spacing counted in) against
   the room it has, as a factor for its font size (--fit; 1 while it fits). Measured on a canvas once per name, and
   not kept while the font is still loading. */
const fitCache = new Map();
```

### GlassTip
- File: `src/App.jsx` lines 3816–3875

```jsx
const GlassTip = ({ x, y, W, H, label, value, color, below, sub }) => (
  <div className={`glass-tip${below ? " below" : ""}`} style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}>
    <span className="glass-tip-inner">
      <span className="glass-tip-label">{label}</span>
      <span className="glass-tip-value" style={color ? { color } : undefined}>{value}</span>
      {sub && [].concat(sub).filter(Boolean).map((t, i) => <span key={i} className="glass-tip-sub">{t}</span>)}
    </span>
  </div>
);

/* The box the weekly chart is drawn in (12 October 2026: its axis figures were "the biggest text in the card"). The chart
   is one drawing, `units` wide, stretched to the card's width, so text written at 11 came out at about 18px in his
   window. The box's width is read here, and again whenever it changes, and handed to the styles as --wk: what a pixel
   is in the drawing's units. The axis text is sized and placed with it (.wk-ax), so it is 11px on screen at any width,
   as on the projection chart. Written straight to the element: no state, so nothing is drawn again for it. */
const WeekBox = ({ units, children }) => {
  const box = useRef(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => { const w = el.clientWidth; if (w > 0) el.style.setProperty("--wk", (units / w).toFixed(4)); };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [units]);
  return <div ref={box} style={{ position: "relative" }}>{children}</div>;
};

/* A day's note on the weekly chart, pressed open (11 October 2026: "clicking the hovered ui, the ui expands and below
   the …Rb show a list of expenses for that day and when clicking outside the box the ui disappears and becomes a
   normal hover over ui"). It is the note itself, the same glass, with the list under its figure; it comes in as every
   note does (its own pop) and goes out on a short fade. With no room above its point it stands under it, and it never
   reaches past the chart's sides: both read once, from the layout, before it is first drawn. A press anywhere outside
   it, Esc (which goes no further) or the window resized shuts it. */
const WeekPin = ({ left, top, shut, onShut, children }) => {
  const el = useRef(null);
  useLayoutEffect(() => {
    const t = el.current, wrap = t.offsetParent;
    if (!wrap) return;
    if (t.offsetTop - t.offsetHeight - 16 < -6) t.classList.add("below");
    const l = t.offsetLeft - t.offsetWidth / 2, over = Math.max(0, 4 - l) - Math.max(0, l + t.offsetWidth - (wrap.clientWidth - 4));
    if (over) t.style.marginLeft = `${over}px`;
  }, []);
  useEffect(() => {
    const down = (e) => { if (el.current && !el.current.contains(e.target)) onShut(); };
    const key = (e) => { if (e.key !== "Escape") return; e.preventDefault(); e.stopPropagation(); onShut(); };
    document.addEventListener("pointerdown", down, true); window.addEventListener("keydown", key, true); window.addEventListener("resize", onShut);
    return () => { document.removeEventListener("pointerdown", down, true); window.removeEventListener("keydown", key, true); window.removeEventListener("resize", onShut); };
  }, []);
  return <div ref={el} className={`glass-tip pin${shut ? " shut" : ""}`} style={{ left, top }}><span className="glass-tip-inner">{children}</span></div>;
};

/* goal icons: picked by the user, or inferred from the goal's name (keywords first, AI for anything else) */
const GOAL_ICONS = [
  "savings", "account_balance", "shield", "laptop_mac", "phone_iphone", "headphones", "photo_camera", "watch",
  "sports_esports", "flight", "beach_access", "luggage", "home", "apartment", "chair", "directions_car",
  "two_wheeler", "school", "menu_book", "favorite", "diamond", "celebration", "redeem", "child_care",
  "pets", "fitness_center", "medical_services", "checkroom", "music_note", "trending_up", "construction", "star",
];
```

### SlideSeg
- File: `src/App.jsx` lines 4893–4917

```jsx
const SlideSeg = ({ options, value, onPick, style, cls = "" }) => {     // cls must never change: "go" is put on the element by hand, and a rewritten class name would take it off
  const wrap = useRef(null), box = useRef(null), fill = useRef(null);
  useLayoutEffect(() => {
    const el = wrap.current, on = el.querySelector("button.on");
    if (!on) return;
    box.current.style.transform = `translateX(${on.offsetLeft}px)`;
    fill.current.style.transform = `translateX(${on.offsetWidth - el.clientWidth}px)`;
    // put in place without a move the first time; every switch after that slides
    if (!el.classList.contains("go")) requestAnimationFrame(() => el.classList.add("go"));
  }, [value]);
  return (
    <span className={`wr-seg slide ${cls}`} style={style} ref={wrap}>
      <span className="seg-box" ref={box}><span className="seg-fill" ref={fill} /></span>
      {options.map(([v, label, title]) => <button key={v} className={v === value ? "on" : ""} title={title} onClick={() => onPick(v)}>{label}</button>)}
    </span>
  );
};

/* ---------- live prices: the latest price of the coin or stock typed in a calculator ----------
   Asked of the Mac app (the page itself can't reach the internet) a moment after the name is typed, then again every
   couple of seconds for as long as the calculator is open. Every price that arrives is remembered in the side's prefs
   (the `book` the tracker hands over), so the last one shows at once next time, and offline it is all there is.
   A plain browser has none. */
const QUOTE_MS = { crypto: 2000, idx: 5000 };        // how often a price is asked again
const QUOTE_MIN = { crypto: 2, idx: 4 };             // letters a name needs before it is asked (a stock code has four)
```

### AmountField
- File: `src/App.jsx` lines 2055–2088

```jsx
const AmountField = ({ value, setValue, onSubmit, accent, cur, ghost, width, allowDecimal, hint }) => (      // hint: a figure worked out for him, shown while the box is empty
  <span style={{ position: "relative", display: "inline-block", width: width || 140 }}>
    <input aria-label={`Amount (${cur})`}
      className={`amt-field ${accent}${hint ? " auto" : ""}`}
      style={{ ...S.darkInput, width: "100%" }}
      placeholder={hint || `${cur} 0`}
      value={value}
      onChange={(e) => setValue(sanitizeAmount(e.target.value, allowDecimal))}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        if (ghost) { setValue(parseNum(digitsOf(value) + "000").toLocaleString("id-ID")); return; }
        onSubmit();
      }}
      inputMode={allowDecimal ? "decimal" : "numeric"}
    />
    {ghost && (
      <span style={S.ghostOverlay} aria-hidden="true">
        <span style={{ visibility: "hidden" }}>{value}</span>
        <span style={{ color: "#8e969e" }}>.000</span>
      </span>
    )}
  </span>
);

/* A logged row is moved to another day by its bar (11 October 2026: "drag and drop (mac style)", by "the gray bar
   inbetween expense rp text and description"; "all the transitions … very smooth and seamless. no lag"). Held and moved
   a few px, the row dims where it is and a small copy of it (amount, bar, name) comes out of the bar and stays under the
   pointer, its own bar on the spot that was taken hold of. A ring glides to the day it is over. Let go there, the copy
   flies into that day and the page is told (o.drop(day)); let go anywhere else, or Esc, and it goes back to its row.
   None of it is React state: the copy and the ring move by transform, written once a frame at most, and the row's and
   the bar's looks are classes put on by hand. The days' places are read once, as the drag begins, and kept as places
   on the page, so scrolling needs no reading; near the top or the bottom edge of the window the page scrolls by itself.
   o: { grid: the calendar's grid, kind: "exp" | "inc", day: the day the row is on, drop(day) } */
const DND_START = 4, DND_EDGE = 70, DND_SCROLL = 900, DND_FLY_MS = 280;
```

### Avatar
- File: `src/App.jsx` lines 1540–1555

```jsx
const Avatar = memo(({ pic, img, bg, bgImg, bare }) => {
  const fid = `pxSh${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;      // each picture its own shadow (the same id twice in a page is one filter for all)
  if (pic === "own" && img) return <img className="av" src={img} alt="" draggable={false} />;
  const a = AVATARS.find((x) => x.id === pic) || AVATARS[0];
  return (
    <svg className="av" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      <defs>
        <filter id={fid} x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="-0.16" dy="0.27" stdDeviation="0.27" floodColor="#4b5060" floodOpacity="0.46" /></filter>
      </defs>
      {!bare && <g shapeRendering="geometricPrecision">{bg === "own" && bgImg ? <image href={bgImg} width="16" height="16" preserveAspectRatio="xMidYMid slice" /> : avBack(bg)}</g>}
      <g filter={`url(#${fid})`}>{pxRects(PX_BODY, a.body || PX_SKIN, "b")}</g>
      {a.head !== "none" && <g filter={`url(#${fid})`}>{pxRects(PX_HEAD, a.head || PX_SKIN, "h")}</g>}
      {a.on.length > 0 && <g filter={`url(#${fid})`}>{a.on.map(([fill, runs], i) => pxRects(runs, fill, `o${i}-`))}</g>}
    </svg>
  );
});
```

### BkTip
- File: `src/App.jsx` lines 231–248

```jsx
const BkTip = ({ name, say }) => <span className="bk-tip"><b>{name}</b>{say}</span>;

/* ---------- warm-up: the screens he has opened before are drawn once more, all but invisibly, under the opening screen ----------
   The first time a screen is shown after a launch it pays for things its second showing doesn't: its text is shaped in
   every font, weight and size it uses, the system is asked for a font for the few characters Inter lacks, pictures are
   decoded, and the graphics process builds a small program for each new kind of paint, blur and blend. A burst of
   those freezes a few frames: the lag Rassam saw the first time he went to the wallets, scrolled down to a card or
   opened a chart, and never the second time. None of it can be asked for ahead of time, except by drawing the thing.
   So a moment after a screen has settled, its markup is filed away (IndexedDB "flow-warm", apart from his data and
   never in a backup), and at the next launch every filed screen is put back into the page for a couple of frames:
   laid out, painted and drawn at next to no opacity, in a box nothing can click or focus, then thrown away. That is
   done while the opening screen stands still (its pieces have landed, the outro hasn't begun), the screens needed
   soonest and used most recently first, as many as fit (about a dozen); nothing of it runs once the app is in use. It never touches
   the real panels or their state, so it can't break them; it only makes their first showing as cheap as their
   second. A screen he has never opened is simply not warmed. */
// a screen is filed this long after it opened, once its own animations are over, and again later if he is still on
// it (by then he has scrolled, and the cards further down have come in), each time when the page is idle
const WARM_SETTLE_MS = 1400, WARM_AGAIN_MS = [7000, 25000];
```

### UndoNote
- File: `src/App.jsx` lines 993–1018

```jsx
const UndoNote = memo(function UndoNote() {
  const [it, setIt] = useState(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    undoHub.say = (v) => { if (v) setIt(v); setOn(!!v); };
    return () => { undoHub.say = null; };
  }, []);
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => setOn(false), UNDO_MS);
    return () => clearTimeout(t);
  }, [on, it]);
  const undo = () => { if (!on || !it) return; setOn(false); it.back(); };
  return (
    <div className={"undo-note" + (on ? " on" : "")} role="status">
      <span className="un-t">Deleted <b>{it ? it.what : ""}</b></span>
      <button className="un-b" tabIndex={on ? 0 : -1} onClick={undo}>Undo</button>
    </div>
  );
});

const MAX_AMOUNT = 1e13;   // Rp 10.000 trillion: far above any real entry, well inside exact number range
const parseNum = (s) => {
  const n = parseInt(String(s).replace(/[^\d]/g, "").slice(0, 14), 10);
  return isNaN(n) ? 0 : Math.min(n, MAX_AMOUNT);
};
```

### PxFig
- File: `src/App.jsx` lines 2256–2265

```jsx
const PxFig = ({ text }) => {
  const t = String(text);
  if (!/^[-\d]+$/.test(t)) return t;
  return (
    // (the page-wide rule gives every element Inter, so each piece has to take the face of what it stands in)
    <span style={{ display: "inline-block", marginRight: "-0.125em", fontFamily: "inherit" }}>
      {[...t].map((ch, i) => (ch === "1" || ch === "-" ? <span key={i} style={{ marginLeft: "-0.125em", fontFamily: "inherit" }}>{ch}</span> : ch))}
    </span>
  );
};
```

### CountNum
- File: `src/App.jsx` lines 1167–1184

```jsx
const CountNum = ({ value, duration, render, still }) => {
  const [n, busy, span] = useCountUp(value, duration, still);
  return <>{render(n, busy, span)}</>;
};

/* Rolling digit for the year label */
/* One step per swipe, for everything that steps on the scroll wheel (the year stacks, the chart pop-ups).
   A trackpad keeps sending wheel events after the fingers have left it (the glide), longer and less evenly with one
   more finger resting on it. A lock that simply ran out after half a second let that tail step again: 2026 → 2028.
   Waiting for the wheel to fall quiet fixed that, but left a second swipe dead for as long as the first one's glide
   was still running (a second or more, unless the pointer was moved, which ends a glide), and he swipes twice in a row.
   What tells a hand from a glide is that a glide only ever dies away. So a new swipe begins:
   - when the wheel has been quiet for WHEEL_QUIET_MS, or
   - when the events grow again: one WHEEL_SURGE times bigger than what the stream had died down to, and at least
     WHEEL_SURGE_PX more. Not within WHEEL_AGAIN_MS of the step, while that swipe itself is still gathering speed.
   Nothing here runs on a timer. tools/wheel-test.mjs feeds it trackpad streams: run it after touching this.
   `lock` is a ref of the caller's; `big` is whether this event moved far enough to count; `delta` is how far. */
const WHEEL_QUIET_MS = 600, WHEEL_AGAIN_MS = 300, WHEEL_SURGE = 3, WHEEL_SURGE_PX = 10;
```

### RollWord
- File: `src/App.jsx` lines 2541–2565

```jsx
const RollWord = ({ text, up, step = 24 }) => {
  const [st, setSt] = useState({ now: text, old: null, id: 0 });
  if (st.now !== text) setSt({ now: text, old: st.now, id: st.id + 1 });
  const gone = st.old === null ? 0 : RW_OUT_MS + Math.min(step * (st.old.length - 1), RW_OUT_SPREAD_MS);      // when the old word has left
  const letters = (word, cls) => {
    const out = cls === "rw-out", each = out ? Math.min(step, RW_OUT_SPREAD_MS / Math.max(1, word.length - 1)) : step;
    return [...word].map((ch, i) => <span key={i} className={cls} style={{ animationDelay: `${Math.round((out ? 0 : gone) + i * each)}ms` }}>{ch}</span>);
  };
  return (
    <span className="rollw" style={{ "--ry": up ? "65%" : "-65%" }}>
      {st.old !== null && <span key={`o${st.id}`} className="rollw-old" aria-hidden="true">{letters(st.old, "rw-out")}</span>}
      <span key={`n${st.id}`}>{letters(st.now, st.id ? "rw-in" : "rw")}</span>
    </span>
  );
};

/* Quick add on the yearly panel: today's expense or income without opening the month and the day. One row, no list;
   anything added is edited on its date, as before. It keeps what is typed to itself, so a keystroke re-renders this
   box and nothing behind it. api.current.add(kind, amount as typed, description) files it and gives back the amount
   as the app writes it, or null when there is no amount. */
// its words: [the chip, the chip's tip, the grey hint in the second box, the button's tip] for each of the two kinds. The
// trading sides hand over their own (a win or a loss and its coin, stock or symbol), and start on the green one
const QADD_FIN = { first: "exp", desc: "Description",
                   exp: ["Expense", "Expense · click (or press +) for income", "Today · lunch, fuel, coffee", "Add to today's expenses"],
                   inc: ["Income", "Income · click (or press −) for an expense", "Today · salary, bonus", "Add to today's income"] };
```

### GoalRing
- File: `src/App.jsx` lines 3911–3923

```jsx
const GoalRing = ({ pct, color, delay, children }) => {
  const R = 21, C = 2 * Math.PI * R, f = (C * Math.max(0, Math.min(100, pct))) / 100;
  return (
    <span className="goal-ring">
      <svg viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5.5" />
        <circle className="score-arc goal-arc" style={{ animationDelay: `${delay || 0}ms` }} cx="26" cy="26" r={R} fill="none" stroke={color}
                strokeWidth="5.5" strokeLinecap="round" strokeDasharray={`${f} ${C}`} />
      </svg>
      <span className="goal-ring-n">{children}</span>
    </span>
  );
};
```

### Reveal
- File: `src/App.jsx` lines 6622–6640

```jsx
const Reveal = ({ children }) => {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: "0px 0px -12% 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={seen ? "rv seen" : "rv"}><Fragment key={seen ? "in" : "wait"}>{children}</Fragment></div>;
};

/* A card under the calendar, on both sides: it pops in when it is scrolled into view and folds away on its arrow.
   Seen, open and the replay count are its own, so none of them re-renders the tracker around it (on the finance side
   that was the whole panel worked out again, 17ms, as each card came into view and on every press of an arrow).
   style: extra for the card. loose: what reaches out of the fold is shown (an open menu). parts: its content is made
   of Reveal parts that open themselves, so it isn't put there afresh when the card is seen. */
// each card's own colour, muted: its title is a tag in it and a soft glow of it sits behind the title. The glow is a
// band of a fixed height at the top (never sized from the card), so folding a card draws nothing again
const CARD_TINT = { "weekly expenses": "#86bfe8", "money flow": "#7fd8b4", goals: "#e3c477", "PnL analysis": "#86bfe8", performance: "#7fd8b4", coins: "#e3c477", stocks: "#e3c477", pairs: "#e3c477", breakdown: "#8fa3b8" };
```
