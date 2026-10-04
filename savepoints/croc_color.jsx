import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";

const STORE_KEY = "pnl-calendar-idr";
// RELEASE SWITCH: set to false for the official build to hide "Add test data" / "Clear test data"
const SHOW_TEST_TOOLS = true;
// AI helpers (categorising expenses, picking goal icons) need the Claude sandbox; locally they're skipped
// quietly and the built-in keyword rules do the work instead
const AI_OK = typeof window !== "undefined" && !!window.storage;

/* Persistence adapter.
   - Inside Claude artifacts, window.storage is provided.
   - Running locally (vite/CRA/Electron), fall back to localStorage so the
     data survives reloads, restarts and app packaging. */
const store = {
  async get(key) {
    if (typeof window !== "undefined" && window.storage?.get) return window.storage.get(key);
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    if (v === null) throw new Error("not found");
    return { key, value: v };
  },
  async set(key, value) {
    if (typeof window !== "undefined" && window.storage?.set) return window.storage.set(key, value);
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    return { key, value };
  },
};
const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const DOW_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DEFAULT_LIMIT = 50_000;
const WARN_YELLOW = 300_000;
const WARN_RED = 200_000;
const MYR_RATE = 4400;
// RM shown to one decimal, rounded to the nearest 0.1 (11.49 → 11.5)
const oneDp = (rm) => (Math.round(rm * 10 + 1e-9) / 10).toFixed(1);
const WARN_FRAC = 0.75; // weekly line turns yellow above 75% of the daily limit (37.5Rb of 50Rb)
const DOTS_PER_ROW = 12;
const YEAR_BLOCK = 392;   // height of one year block in the scroll stack

const pad = (x) => String(x).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const monthKeyOf = (y, m) => `${y}-${pad(m + 1)}`;
const uid = () => Date.now() + "-" + Math.random().toString(36).slice(2, 7);
const MAX_AMOUNT = 1e13;   // Rp 10.000 trillion: far above any real entry, well inside exact number range
const parseNum = (s) => {
  const n = parseInt(String(s).replace(/[^\d]/g, "").slice(0, 14), 10);
  return isNaN(n) ? 0 : Math.min(n, MAX_AMOUNT);
};
const cleanAmount = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(n, MAX_AMOUNT)) : 0; };
const digitsOf = (s) => String(s).replace(/[^\d]/g, "");

// loading/importing: keep only well-formed day keys and entries, so one bad item can't turn totals into NaN
const migrateSpending = (sp) => {
  const out = {};
  if (!sp || typeof sp !== "object") return out;
  for (const k in sp) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    const v = sp[k];
    if (typeof v === "number") { out[k] = [{ id: uid(), amount: cleanAmount(v), desc: "" }]; continue; }
    if (!Array.isArray(v)) continue;
    const items = v.filter((it) => it && typeof it === "object").map((it) => ({
      ...it, id: it.id || uid(), amount: cleanAmount(it.amount), desc: typeof it.desc === "string" ? it.desc : "",
    }));
    if (items.length) out[k] = items;
  }
  return out;
};
const migrateIncomes = (inc) => {
  const out = {};
  if (!inc || typeof inc !== "object") return out;
  for (const k in inc) {
    if (!/^\d{4}-\d{2}$/.test(k) || !Array.isArray(inc[k])) continue;
    out[k] = inc[k].filter((it) => it && typeof it === "object").map((it) => ({
      id: it.id || uid(), amount: cleanAmount(it.amount), desc: typeof it.desc === "string" ? it.desc : "",
      day: Number.isInteger(it.day) && it.day >= 1 && it.day <= 31 ? it.day : null,
      ...(it.test ? { test: true } : {}),
    }));
  }
  return out;
};

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const GREEN = [61, 220, 151];
const YELLOW = [245, 211, 75];
const RED = [255, 93, 108];
const spendColor = (spent, limit) => {
  if (spent > limit) return rgb(RED);
  const soft = limit * 0.9;
  if (spent <= soft) return rgb(GREEN);
  const t = (spent - soft) / (limit - soft);
  return rgb([lerp(GREEN[0], YELLOW[0], t), lerp(GREEN[1], YELLOW[1], t), lerp(GREEN[2], YELLOW[2], t)]);
};
const spendTint = (spent, limit) => {
  if (spent > limit) return "rgba(255,93,108,0.12)";
  if (spent <= limit * 0.9) return "rgba(61,220,151,0.10)";
  return "rgba(245,211,75,0.10)";
};
const spendBorder = (spent, limit) => {
  if (spent > limit) return "#5a2830";
  if (spent <= limit * 0.9) return "#1e4436";
  return "#57501f";
};
const remainColor = (remaining) => {
  if (remaining < WARN_RED) return rgb(RED);
  if (remaining < WARN_YELLOW) {
    const t = 1 - (remaining - WARN_RED) / (WARN_YELLOW - WARN_RED);
    return rgb([lerp(YELLOW[0], RED[0], t), lerp(YELLOW[1], RED[1], t), lerp(YELLOW[2], RED[2], t)]);
  }
  return rgb(GREEN);
};

/* Animated number: eases from whatever it currently shows to the new value */
const useCountUp = (value, duration) => {
  const [n, setN] = useState(0);
  const [busy, setBusy] = useState(false);
  const [span, setSpan] = useState({ from: 0, to: 0 });
  const cur = useRef(0);
  useEffect(() => {
    const start = cur.current;
    setSpan({ from: start, to: value });
    const delta = value - start;
    if (delta === 0) { setN(value); setBusy(false); return; }
    setBusy(true);
    let raf, t0 = null;
    const step = (t) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      const v = start + delta * e;
      cur.current = v;
      setN(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else { cur.current = value; setN(value); setBusy(false); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return [n, busy, span];
};

const CountNum = ({ value, duration, render }) => {
  const [n, busy, span] = useCountUp(value, duration);
  return <>{render(n, busy, span)}</>;
};

/* Rolling digit for the year label */
// one continuous smooth path through a list of points
const smoothPath = (p) => {
  if (!p.length) return "";
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let k = 1; k < p.length; k++) {
    const a = p[k - 1], b = p[k], dx = (b.x - a.x) / 2;
    d += ` C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
};

const CurrencyRoll = ({ idx }) => {
  const h = 17;
  return (
    <span style={{ display: "inline-block", height: h, overflow: "hidden", verticalAlign: "top", lineHeight: `${h}px` }}>
      <span style={{ display: "block", transform: `translateY(${-idx * h}px)`,
                     transition: "transform .42s cubic-bezier(0.32,0.72,0.24,1)" }}>
        <span style={{ display: "block", height: h }}>IDR</span>
        <span style={{ display: "block", height: h }}>MYR</span>
      </span>
    </span>
  );
};

const DigitRoll = ({ digit, size }) => {
  const h = Math.round(size * 1.02);
  return (
    <span style={{ display: "inline-block", height: h, overflow: "hidden", verticalAlign: "top" }}>
      <span style={{ display: "block", transform: `translateY(${-digit * h}px)`,
                     transition: "transform .55s cubic-bezier(0.32,0.72,0.24,1)" }}>
        {[0,1,2,3,4,5,6,7,8,9].map((d) => (
          <span key={d} style={{ display: "block", height: h, lineHeight: `${h}px` }}>{d}</span>
        ))}
      </span>
    </span>
  );
};

const SimChip = () => (
  <svg className="sim" viewBox="0 0 46 36" fill="none">
    <rect x="0.6" y="0.6" width="44.8" height="34.8" rx="5" fill="url(#chipG)" stroke="rgba(70,78,86,0.55)" strokeWidth="1" />
    <defs>
      <linearGradient id="chipG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#cfd4d9" /><stop offset="45%" stopColor="#9aa1a8" />
        <stop offset="70%" stopColor="#dfe3e7" /><stop offset="100%" stopColor="#a7aeb5" />
      </linearGradient>
    </defs>
    <g stroke="rgba(60,68,76,0.6)" strokeWidth="1.1" fill="none">
      <path d="M15 0.6 V12 H1" />
      <path d="M15 35.4 V24 H1" />
      <path d="M31 0.6 V12 H45" />
      <path d="M31 35.4 V24 H45" />
      <path d="M15 12 H31" /><path d="M15 24 H31" />
      <path d="M23 12 V24" />
    </g>
  </svg>
);

const WALLETS = [
  { id: "puzzle", cards: ["palladium", "platinum"],   exp: "12-26", year: 0 },
  { id: "arena",  cards: ["coutts", "couttspurple"], exp: "12-27", year: 1 },
  { id: "python", cards: ["obsidian", "ivory"],       exp: "12-28", year: 2 },
];

const PATTERN_OF = {
  palladium: "ornate", platinum: "damask",
  coutts: "none", couttspurple: "none",
  ivory: "guilloche", obsidian: "guilloche",
};

const CardPattern = ({ variant }) => {
  const kind = PATTERN_OF[variant] || "guilloche";
  const [uid] = useState(() => `p${Math.random().toString(36).slice(2, 8)}`);
  const motifs = kind === "ornate" || kind === "damask";
  return (
    <svg className={`cf-pattern cf-pat-${kind}`} viewBox="0 0 400 250" preserveAspectRatio="none">
      <defs>
        <pattern id={uid} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M11 0 V22 M0 11 H22" stroke="currentColor" strokeWidth="0.55" opacity="0.5" />
          <circle cx="11" cy="11" r="4.8" fill="none" stroke="currentColor" strokeWidth="0.55" opacity="0.45" />
        </pattern>
      </defs>

      {kind === "guilloche" && <rect width="400" height="250" fill={`url(#${uid})`} />}

      {kind === "damask" && (
        <g>
          <rect x="12" y="12" width="376" height="226" rx="12" fill="none"
                stroke="currentColor" strokeWidth="1.6" opacity="0.7" />
          <rect x="18" y="18" width="364" height="214" rx="9" fill="none"
                stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
        </g>
      )}

      {motifs && (
        <g className="cf-motif" fill="currentColor" stroke="currentColor">
          {/* left cloud-scroll cluster */}
          <g transform="translate(30,66) scale(1.05)">
            <path d="M6 30 C0 18 10 6 24 8 C30 0 46 0 50 10 C64 6 76 14 74 26
                     C86 26 92 36 86 44 C78 52 62 50 58 42 C50 52 32 52 26 42
                     C14 46 4 40 6 30 Z" stroke="none" opacity="0.92" />
            <circle cx="36" cy="28" r="7.5" fill="#000" opacity="0.001" />
          </g>

          {/* right large S-curl */}
          <g transform="translate(266,52) scale(1.08)" fill="none" strokeLinecap="round">
            <path d="M92 14 C72 4 48 14 44 34 C40 52 56 66 70 60 C82 55 84 40 74 36"
                  strokeWidth="12" opacity="0.92" />
            <path d="M26 82 C40 90 58 86 66 74" strokeWidth="10" opacity="0.85" />
            <path d="M16 114 C34 120 54 112 60 98" strokeWidth="8" opacity="0.7" />
          </g>

          {/* lower-left curl */}
          <g transform="translate(42,148) scale(1)" fill="none" strokeLinecap="round">
            <path d="M10 58 C-2 40 10 18 30 16 C46 15 56 29 48 42 C42 51 29 50 27 42"
                  strokeWidth="12" opacity="0.9" />
            <path d="M62 22 C80 22 92 34 92 48 C92 60 82 68 72 64" strokeWidth="10" opacity="0.8" />
            <path d="M104 66 C118 60 128 46 126 32" strokeWidth="8" opacity="0.62" />
          </g>
        </g>
      )}
    </svg>
  );
};

/* ---------- the crocodile logo: the original artwork, background removed (192×179, own palette) ---------- */
const CROC_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAACzCAMAAADotONaAAAAeFBMVEWg0k7cul8eMBdnp0JspTjs642frk3S2mI6aydJXirW4tK0246TlZKT2T6Cbzx+wDZ/wEI+izJCOyKVf0kAAACd4E312oBWljlKhS+a3UvjvV3z2H1EeCs6Zyek5lD9/f3R+GIAAAAnQhzpxWiDvTmIxDs0WyRppzuLQ59BAAAAKHRSTlP//////////////////////////wD/////////////////////////SwSqoAAAEOZJREFUeNrtnQt/ozYSwIUhBrbdtndXDDKPposN3/8bHtLMCL0A4Rh773edtpsm6zj6My9pNFLYn8dLUzWVJc97c/YCgMqVfwD+Afi/Amj+0cDbNdA0TSak+ZkAmjEBqZJxkqpK2mEY2knoFWdH4sYrWfMOgIR1Qhi/s0nu9+93HE410Hunn5akeQtiWVRZvQEgZlxIwW53kARGlzcK4FMjSCf57AjA9uvmLQBF4QNomxUNND8RQEIAdwJo2+x/CWDsbIBmWwP5T6UBXoh/0IRuM0C7poHcC/AOJx5tJ74RwJ+LAF1LGhDR6s0AZ1Z0kxV1LLlJmZ0490UhqYDOCZ9vMCEmI2KaYnD8PFelGMf0B5lH+okv6BalkNrjXSK/J59ir6BoHgDZD2CbRayeJwGoB84LKRyHW+BH+b/yL7pksJz6vQCtBVAYIkctMdRXJg2YAM37AfJFACTQv/CzA7gjtoh+AoDUBJgmljoA5/aYbYDhvQAi1swAeZ5P4b2tCC1VDssN71VUGgCmhTdoIFUAap5DETZVo+4KO4y+QQMjE+kquTFcnMhEPK0ERgIYGYoaJo2fjShxLP6b/uCIAN9wZuNkfG2ezWucIwA4zBhowKXASZJbQg/vTHm345rNCIB4SnOmEAChnlF72e58sE8DYs420iBud5hB0M8808yhI8clgGQRgFNGHsxwdJAG5IBnABAfAKeUtQygRacJIB7MtebbAWDwCqB0AKyEFrcvALiLefPtpgDuN9uEPmcADlOgAnxgG+AFGkgEgNAA2cMdNeIH0KZvnceJgYzbGsiPNSGKQjB/xrJQaUehlKJ+8f075+LfcV4AgFTcSAjSiYUOhiM1UEEhq/zlG8oHyC+MQzRXg0ow6p8/6CUkv5IGKDGwDgCY/B5RJTsOYMggUn/7y5KPwspbOK/OYvuVf31LYhCRtcX7jRCNFDs/EGBaKjZNnrcuwLxggeRUySVv03oASgIAaUczHxRHAgwNlBx8AOZ8uZKsuwDU0q15E4DOsEcDiQnQHQ/gNaHuYYB4iliv1UC7BDAj7APgxfsB4CHyxwDEN5AWZieuDgRQeUDXgK4CAZCJtWX8zX6p68SFXmcRPvD19YCV9CsLoDn9DXKyNGCYUCbWxi2+8u9flwAySs0jJbQfKFkoiANQxYkmZVxaAFkQgHi6zeAHKFcBTgAQ7AsOQGPPfYMAuK2BaYW4DFDGDTzhdkEDpx9yY/AhDdgAtgm1LgD4QLAGBELTLgGcDIDqARPaD2BGIcgDwouHFR/wAHAXoKpeooECNMBpfYhhdB+AXIUWDF3gQBPK/CakL3ABYJ8G5BOYACgKNQ9Hocby4WYnQPGgBsB9Jg2chGTSfnYBsPONnacVBrNqaGwKppNjqJVX6QPgxlyoxBjYhgOoFc79DKWu4ccgJGsz6FHYBuA4cubsa+HXYWEbBICozQ4AEnpuwplPcz6oAgBwQdXZALg479YAzESmVsn7AUZa2AwnwxeCAGA25QBglaej6tSxAKRGBVBJZwjTAMSQdYDDNYCzUhMgxISKRYDiURPansw1foDiEYBuyQc6KLKp6tT2VCIEIJfjz/0mZGog0IkLikKptYU0l5jlzrQH4Hunkpj8AGG0WQQooazSLvgA3wcwRX6xWzGK8SWivoZ9TAwn1GeVEFDOELBvjKpVjNO2ERow+0O8Lj7H8MLbOL+UMbEpwum9WPJ1AA5bKqw5gSQMK/b4+YlUQWW2T2v/RatCF+auRWdv1XDnr1i1HYW2AOCndwoAnLmLKamTSREA0yq3ZLHGop525gtjn0aufQvza9Pss/w6AM7EbQDSwOACdFTDwhozFNILzhe3VL1/JafPBwCASXdn/DxbAlBPnVOlnK/tCfv3iRdMqNsBwL4AoD1L+DSUgLYGAnyg2coDrPCbEAH8WDEh9dD5op0sMwCAby60F4B7NRATwCduffkBFrogNgau4pWjgXk2CoKz0XIbYMRFXIwaYJjsEysPpNomarHX6G3peBzLLQO18fbH9IlINtL0YU2zvjJDgHmLgcbXueFe2/gq5hj6NQLYZ+q4WsGi0M/fXpExPZZo6cj+fLXx52HBLFiwGQD+oOS4DcA3DTXYoh/H0AHA5mlWGgLAHxgXf9bYMfp+AYAtvOUaE9/97PluDeACMQiA79YAdw157i3YC2DMiSyAIsCEzB6kkAjJjezrTj4fcWQ7CoUDMG+02Yrx+jSCWac0WLepgmnZNMmUVKhFipVJMo7JaAJMslnZUqlQ/7HhcwKYiFPalJn7lHcLzPNDYZdLfZFSg6SJbCS5J7RWpnRfbtaFTABrx7TYmB/jSuKHLhMAt7Mctx4Lg2EjxfQ/AkD27igAfCUdwwwE4NyTd+e0VnDuvsQL4PV1zepqVIAGIHthvgog3rxbSPmF7Z2dmoh7ADw+pH1BaMAG8GmA870A3KeEDfGakNYMxI1g6wGYLCn9HRvwTB/YB4AFuNNu+eEDsNeSxvzJMKF6HWBrPWBpgCV/75U5CInhn05tx/Xn7psE6hqQ/zcBGCbUUBgN0AAK67Ccsh8gNyRrOm3r2hi/KOGLoM8UAEZR6cS6BhqyzyoLrU4n3+EoT7Ub4Lc66kmiPorSghcLs/AUnjcMWgh9X0odhARAmTnTaqRCGe0ygMwkjwDkdW9IOlu+YfjcAADr76/AbQNAf930HwKcWliguTvfCuCGAM0TAai4pWtAM3wAkAgpNaHaZWsdQC4xFwHu2FWZoCn/2441+ZL8xwcAfmwt8hQAJmGlAdeEKseEFnoPdADRDJ0wLD5M5okO9nERn34sSo0vhI8EwH1r0hTHrQKoArhtAGRVswlwB4CahoNS75W0WCQAH6jnACoBosnx0YBXAEI0MBEk7OKM6LIiPgD/dIo0UOtTiP6KBNsAmxqAxtzfGcaIsPF7EC7pXP63DkTMTkzSX6NIAtxoOl1VKgjpAO0mgDph+GElmS2Ai5oah1mY4QMsEe1JcRzbWisrJw9IgCwIQGl4nrMHEPgNCv+qtjIYApyNZo95fVq4ANVuAPVTQwDky+rLZevpm984A2hLJDknXgIIMiFzbJd9QiG+1k3Q8/QXNEAp4ysAlAh2Dtz5HFCMoHN5AQDdBhH1tnyJqPa/hJntNmsAoU5Mkovgpkt/2WtNm4S6BhwACKTZD3PHPhzgt8MBJvk4b2igysRyaZrM0UZH+xMAQLoGWQIoVLvC0Mr7Tobdrcc+E3oOwTR9iM4JnGscrc09JZV1/cr+3mmfBjDfGtOxBwDSHgFuAQDQqPcgwHV6VkLkn70ZWD8e14AXgPsBsrYN7JnbNKEoteTRMDtNoTcBuAbQPgbgiHmRxRTUhIJIJiVd9/uAAWAWMHSA9giAKa9E/VWXPjQCLQKoA98WQH4IQGVoIBCgJp9aAFDlcVFSlOuC9mEnfhpAbQKAvfkAjNo+nW/PHw6jB2gAqihSCQhwd00IW4vyk+x7PYU3vm5K5gGIAEJ+6JfNXn3sr/BN/RKA6o3KrVnoERq4WmH0I8gHhAK8AFgDg2rSMQBaZhdx1L6DLZUlmNU6TH/FpLioAXDjQwDc87kVNJZjf3mWXG2Joqvna6IOsQbAXwdgJoYkvW4KDH9VA1BTfTnAlHKS/hokvjwQ2/vsA26ZvE4DYQDk8E4e4JYGGnlGfWjJ5V5gQh4fcJ69irXMAiiVJri5rzPAFlx2MIB4SAEA12utKnJrANqWMjb/ZT+HBoIB5t311wDAvDG5RqlMU88C0JrADwFQtwWADA1VozcBVn3AXBe8AmAgALzxj0VBTix6+70AxasBZg0gQEB51y6r6J277wO4awCBhS279Vj2PYnOJwpG1IIsFsbehc1RAEH19doFMG5QkhkZATCjZe8A8JbW0RfWALiuASoTvcKJHYB6caPhXK0CuBp4C8DyRs/HKkAxJzIF0BwCMFgAF62nQxlP7dkm+Dj/awkAE1mGfQJH+IDYTRVnqhpbA/oWuVFKdSWl5dzoA5gQ8MKhpDrAhKDzp2PVYAHQ1Nm3r2ovkvtplSm2uuk88cJFdKzMng/Q4erPAUjFvD+aAerlraaa1jg4/sQCUMuE6hAAaHwVAMOwpAE3hBrdBhbAaJmQmtUdoQF1hH6Qt8avAdj7Mz8JQBcIYJmOTrBsQi8A6GYAQTBP5iwnruftb2dbZ00D+mnHrjzIBwAAZAkA0rBuNxePBvAyGlcD0OJfLnUvfuH2+/kaCbiuObEWNL05GdIQPD5A+UABzCdl4b4Wusvw6wB0f4O6tZXUfsZ+stprQohgTYkUwBWbNvWbKEULEZlQLneLTye6CrD9CoBxT2LR4eWL1ZnCvqOBufPDrfZSwQ4/agCyCW4GoO5FyxceAjBPpCoAnDbYABfNkNYBTA3IHi6OBw2fCHBmhXG1mgFQ+0yoXm7+MgDE9qWrAbNa/QSAkXELAI/vQLOaBaBab7YAoDKsABJsJMUuKLljI9zAWRc8cPs9M+uwswY8AHZf4DJAbwJgJ+/N8oFnANg+UCgNYJSp3U0zsqNwDeDvZNCjEKwLvm5C83EnDNSj/D0Iy05cG32Bhk7UayPsr0ohn43TP3BrKTlxA9f1DM7amO0cuJYh4xIyJ72lbUJaOa62M0BPlS6rZFdTMoRV0tCyzjj3qA7sDHBfadaGA3CnJ4nugAoBuBj9fxd7KyFSNUcDoEWA+RqECsOpvG9K1Ir2AHDz7ggfwMUDEBnRFKZCHoDaBMCpg35BtVx8kAawieKJGsiWADzblgEaGJQGjNujGgPgOSZUbQBE2kRoP4B1QXUFPXSPADCntdMF0EOj5gNf0YAL8KgGWIATLwDoixk/QL8EYD00MqETXRr3RABTA9O8zHFijwaora1f04B2iGXWQDiAmdTFZRy4eqW9sXONHQb2gQJtkDjQ+bgWrQLsOUZqAdAFdOqALF7SPbbBAPTLrghAXaQOe2NVxj6WOju2d7ydFhcbQB00LIz7c7qxbYI1AIcE1awk1kwHNODtvqw3AUSfXV9vAJQzgH5h0R4APCGnTMgF+PCXzuuApoPe/tbUysQagH7UdhfA7XZf0EBFAHtNKJpNyAZA8QEUDwNIBAcAmxcf9wFfm9c0dtmi6jMh7Tw5ATRBPiB/eciN1kYagDSiCWBTA5HTcwONTx4AbLH1AxgakJt+gQDShPAimti6AiJMA1GgBnoyIQsAJzLqF5mN9Es72GonQd5UqsSEd/TNVwHRW5xpP2P7jNzyvjGdw0zyfFrQ5In1KyPKEX86HXuO6V7nRYAKnnQy4gq+G+3tLKwoDud0R+vuZV1bEb3pws6TOrcdqy8sAmCdMqE7IexNoLLFjY1zb7YReJUw34ThlqvV9OPaR7hd1S5tvyqAKhSAyqzdIwB6FTREA300YKfWJkD5BIB2G2CnCU0akEdOVgGKQrt7s3wqQL117modINCEAgGaxPilPa4PVCbA9frgKaHa1MBOH9gGSGin82gTigI1ABIAoHqQUKwVZNM4GljIB6sDp2+C9LwNEFvDCXBiedGufhU4hWobQM+udeAhxV7vhg0BcBNDCIB5lzmN3AGI4Hz5igp8xV2aGCGAjEEvBWh1DQhj2OMLvXr4MLeL4BeVvwtAdj3sAsAzKaQEABjeZkLygoJNALPI26sJNpnQ+wBw1tzb7QQXq8quNSD0ap4td5l6msw9A4AClQWSVK4J2WdRwqW2zgNG9KZlEjT+pGKhrdHzLzAdLDlH+kGUaJ/Y51joTXHbqoRfIo2XYJrPvpJ//19Ax6+8F4Vy4wAAAABJRU5ErkJggg==";
const CrocLogo = ({ className, style }) => (
  <img className={className} style={style} src={CROC_LOGO} alt="" draggable={false} />
);

const CardFace = ({ variant, exp = "12-26" }) => (
  <div className={`cardface ${variant}`}>
    <div className="cf-metal" />
    <div className="cf-grain" />
    <CardPattern variant={variant} />
    <CrocLogo className="cf-logo" />
    <div className="cf-sheen-fixed" />
    <div className="cf-content">
      <SimChip />
      <div className="cf-script">Rassam</div>
      <div className="cf-foot">
        <span className="cf-name">RASSAM MAWARDI</span>
        <span className="cf-exp"><span className="cf-exp-lbl">EXPIRES<br />END</span>{exp}</span>
      </div>
    </div>
  </div>
);

const PuzzleBody = ({ shine }) => (
  <>
    <div className="wall wall-rear puzzle-rear">
      <div className="pz-skin" />
      <div className="wall-lip" />
    </div>
  <div className="hold-front puzzle-front">
    <div className="lp lp-main" />
    <div className="lp lp-wedge" />
    <div className="lp-seam" />
    <div className="lp-lip" />
    <div className="lp-stitch" />
    <div className="anagram">
      <svg viewBox="0 0 100 74" fill="none">
        <g stroke="rgba(48,40,30,0.45)" strokeWidth="3" fill="none">
          <path d="M50 8c-13 0-22 8-22 16s9 14 22 14 22-6 22-14S63 8 50 8z" />
          <path d="M50 66c-13 0-22-8-22-16s9-14 22-14 22 6 22 14-9 16-22 16z" />
          <path d="M18 37c0-13 8-22 16-22s14 9 14 22-6 22-14 22-16-9-16-22z" />
          <path d="M82 37c0-13-8-22-16-22s-14 9-14 22 6 22 14 22 16-9 16-22z" />
        </g>
      </svg>
    </div>
    {shine}
  </div>
  </>
);

const ArenaSkin = () => (
  <>
    <div className="ar-base" />
    <div className="ar-crinkle" />
    <div className="ar-gloss" />
  </>
);

const ArenaBody = ({ shine }) => (
  <>
    <div className="seam-outline seam-arena" />

    {/* rear pocket wall — the card behind sits above this line */}
    <div className="wall wall-rear arena-wall ar-pocket">
      <ArenaSkin />
      <div className="wall-lip" />

    </div>
    {/* front pocket wall */}
    <div className="wall wall-front arena-wall">
      <div className="seam-front seam-front-ar" />
      <ArenaSkin />
      <div className="wall-lip" />

      <div className="anagram anagram-dark">
        <svg viewBox="0 0 100 74" fill="none">
          <g stroke="rgba(22,25,28,0.5)" strokeWidth="3" fill="none">
            <path d="M50 8c-13 0-22 8-22 16s9 14 22 14 22-6 22-14S63 8 50 8z" />
            <path d="M50 66c-13 0-22-8-22-16s9-14 22-14 22 6 22 14-9 16-22 16z" />
            <path d="M18 37c0-13 8-22 16-22s14 9 14 22-6 22-14 22-16-9-16-22z" />
            <path d="M82 37c0-13-8-22-16-22s-14 9-14 22 6 22 14 22 16-9 16-22z" />
          </g>
        </svg>
      </div>
      {shine}
    </div>
  </>
);

const Chevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 9 L12 16 L19 9" />
  </svg>
);

const PythonBody = ({ shine }) => (
  <>
    <div className="seam-outline seam-python" />

    <div className="wall wall-rear py-wall">
      <div className="py-skin py-red" />
      <div className="wall-lip" />

    </div>
    <div className="wall wall-front py-wall">
      <div className="seam-front seam-front-py" />
      <div className="py-skin py-green" />
      <div className="py-scales" />
      <div className="wall-lip" />

      <div className="anagram anagram-py">
        <svg viewBox="0 0 100 74" fill="none">
          <g stroke="rgba(255,240,235,0.4)" strokeWidth="3" fill="none">
            <path d="M50 8c-13 0-22 8-22 16s9 14 22 14 22-6 22-14S63 8 50 8z" />
            <path d="M50 66c-13 0-22-8-22-16s9-14 22-14 22 6 22 14-9 16-22 16z" />
            <path d="M18 37c0-13 8-22 16-22s14 9 14 22-6 22-14 22-16-9-16-22z" />
            <path d="M82 37c0-13-8-22-16-22s-14 9-14 22 6 22 14 22 16-9 16-22z" />
          </g>
        </svg>
      </div>
      {shine}
    </div>
  </>
);

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <g className="trash-lid">
      <line x1="2.2" y1="4.6" x2="13.8" y2="4.6" />
      <path d="M6 4.6 V3.4 Q6 2.6 6.8 2.6 H9.2 Q10 2.6 10 3.4 V4.6" />
    </g>
    <path d="M3.6 4.6 L4.6 13.6 Q4.7 14.2 5.3 14.2 H10.7 Q11.3 14.2 11.4 13.6 L12.4 4.6" />
    <line x1="6.4" y1="7.2" x2="6.6" y2="11.8" />
    <line x1="8" y1="7.2" x2="8" y2="11.8" />
    <line x1="9.6" y1="7.2" x2="9.4" y2="11.8" />
  </svg>
);

/* Defined outside the main component so React keeps the same DOM node
   across renders — otherwise the input loses focus while typing. */
const sanitizeAmount = (raw, allowDecimal) => {
  if (!allowDecimal) {
    const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
    return isNaN(n) ? "" : n.toLocaleString("id-ID");
  }
  // MYR: digits with a single "." decimal, up to two places
  let v = String(raw).replace(/,/g, ".").replace(/[^\d.]/g, "");
  const parts = v.split(".");
  v = parts.shift() + (parts.length ? "." + parts.join("").slice(0, 2) : "");
  return v;
};

const AmountField = ({ value, setValue, onSubmit, accent, cur, ghost, width, allowDecimal }) => (
  <span style={{ position: "relative", display: "inline-block", width: width || 140 }}>
    <input
      className={`amt-field ${accent}`}
      style={{ ...S.darkInput, width: "100%" }}
      inputMode="numeric"
      placeholder={`${cur} 0`}
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
        <span style={{ color: "#6d757d" }}>.000</span>
      </span>
    )}
  </span>
);

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

/* test-data generator presets. amounts in thousands of rupiah; small/mid = [chance per day, min, max],
   big = [min days, max days, min, max] per month */
const SPEND_STYLES = {
  balanced: { label: "Balanced", icon: "balance", desc: "Steady small daily spends, a few bigger days",
              small: [0.88, 10, 50], mid: [0.20, 50, 150], big: [2, 3, 300, 500], weekend: 1 },
  frugal:   { label: "Frugal", icon: "savings", desc: "Light spending and plenty of no-spend days",
              small: [0.62, 5, 30], mid: [0.07, 40, 90], big: [0, 1, 200, 350], weekend: 1 },
  erratic:  { label: "Erratic", icon: "ssid_chart", desc: "Quiet stretches, then sudden spikes; months swing a lot",
              small: [0.70, 5, 90], mid: [0.30, 60, 260], big: [3, 6, 250, 900], weekend: 1, spike: 0.08, monthSwing: [0.5, 1.8] },
  big:      { label: "Big spender", icon: "local_mall", desc: "High everyday spending and frequent large buys",
              small: [0.96, 30, 90], mid: [0.45, 100, 300], big: [4, 6, 400, 1200], weekend: 1 },
  weekend:  { label: "Weekend splurger", icon: "weekend", desc: "Careful on weekdays, lavish on weekends",
              small: [0.80, 8, 35], mid: [0.06, 50, 120], big: [1, 2, 300, 600], weekend: 3.2, weekendMid: 0.65 },
};
const DEFAULT_TEST_CFG = { incMin: 1, incMax: 3, incFreq: "1-2", incTiming: "start", style: "balanced", range: "year", goals: true };
const TEST_CFG_KEY = "pnl-test-config";
// rough monthly spend for a style (shown as a preview in the settings pop-up)
const estimateStyle = (st) => {
  const mean = (a, b) => (a + b) / 2;
  const daily = st.small[0] * mean(st.small[1], st.small[2]) + st.mid[0] * mean(st.mid[1], st.mid[2]);
  const wk = st.weekend > 1 ? (5 + 2 * st.weekend) / 7 + (st.weekendMid ? (2 / 7) * st.weekendMid * mean(st.mid[1], st.mid[2]) / Math.max(daily, 1) : 0) : 1;
  return Math.round((30 * daily * wk + mean(st.big[0], st.big[1]) * mean(st.big[2], st.big[3])) * 1000);
};

/* liquid-glass hover bubble for the SVG charts; positioned in % of the chart's viewBox */
const GlassTip = ({ x, y, W, H, label, value, color, below }) => (
  <div className={`glass-tip${below ? " below" : ""}`} style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}>
    <span className="glass-tip-inner">
      <span className="glass-tip-label">{label}</span>
      <span className="glass-tip-value" style={color ? { color } : undefined}>{value}</span>
    </span>
  </div>
);

/* goal icons: picked by the user, or inferred from the goal's name (keywords first, AI for anything else) */
const GOAL_ICONS = [
  "savings", "account_balance", "shield", "laptop_mac", "phone_iphone", "headphones", "photo_camera", "watch",
  "sports_esports", "flight", "beach_access", "luggage", "home", "apartment", "chair", "directions_car",
  "two_wheeler", "school", "menu_book", "favorite", "diamond", "celebration", "redeem", "child_care",
  "pets", "fitness_center", "medical_services", "checkroom", "music_note", "trending_up", "construction", "star",
];
const GOAL_ICON_RULES = [
  ["laptop_mac", ["macbook", "laptop", "notebook", "computer", "pc", "imac", "desktop", "monitor"]],
  ["phone_iphone", ["iphone", "phone", "hp ", "handphone", "samsung", "pixel", "android"]],
  ["headphones", ["airpods", "headphone", "earbuds", "earphone", "sony wh"]],
  ["photo_camera", ["camera", "kamera", "lens", "fujifilm", "canon", "nikon", "gopro"]],
  ["watch", ["watch", "jam", "rolex", "apple watch", "garmin"]],
  ["sports_esports", ["ps5", "playstation", "xbox", "switch", "nintendo", "console", "gaming", "steam deck"]],
  ["flight", ["trip", "travel", "japan", "korea", "europe", "flight", "holiday", "liburan", "vacation", "tokyo", "bali", "umrah", "hajj", "haji"]],
  ["home", ["house", "rumah", "home", "down payment", "dp ", "mortgage", "kpr"]],
  ["apartment", ["apartment", "apartemen", "condo", "rent", "sewa"]],
  ["chair", ["furniture", "sofa", "desk", "chair", "bed", "kasur"]],
  ["directions_car", ["car", "mobil", "tesla", "bmw", "toyota", "honda"]],
  ["two_wheeler", ["motor", "motorbike", "scooter", "vespa", "bike"]],
  ["school", ["school", "sekolah", "tuition", "kuliah", "university", "education", "course", "mba", "dba", "degree"]],
  ["favorite", ["wedding", "nikah", "married", "anniversary", "ring"]],
  ["diamond", ["jewel", "gold", "emas", "diamond", "luxury"]],
  ["child_care", ["baby", "bayi", "kids", "child", "anak"]],
  ["pets", ["pet", "cat", "kucing", "dog", "anjing"]],
  ["fitness_center", ["gym", "fitness", "bicycle", "sepeda", "marathon"]],
  ["medical_services", ["medical", "health", "hospital", "dental", "insurance", "asuransi"]],
  ["trending_up", ["invest", "saham", "stock", "crypto", "bitcoin", "reksadana", "portfolio"]],
  ["shield", ["emergency", "darurat", "rainy day", "safety"]],
  ["redeem", ["gift", "hadiah", "birthday", "present", "christmas", "lebaran", "eid"]],
  ["checkroom", ["clothes", "baju", "outfit", "fashion", "shoes", "sepatu", "bag", "tas"]],
  ["music_note", ["guitar", "piano", "concert", "music"]],
  ["construction", ["renovation", "renovasi", "repair"]],
];
const inferGoalIcon = (name) => {
  const n = ` ${String(name || "").toLowerCase()} `;
  for (const [icon, words] of GOAL_ICON_RULES) if (words.some((w) => n.includes(w))) return icon;
  return null;
};

/* goal progress bar: grows from 0 on mount, then eases between values */
const GoalBar = ({ pct, done, delay }) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let r2;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setOn(true)); });
    return () => { cancelAnimationFrame(r1); if (r2) cancelAnimationFrame(r2); };
  }, []);
  return (
    <div className="goal-track">
      <div className={`goal-fill${done ? " done" : ""}`}
           style={{ width: on ? `${Math.max(0, Math.min(100, pct))}%` : "0%", transitionDelay: on ? `${delay || 0}ms` : "0ms" }} />
    </div>
  );
};

const SplitBar = ({ remainingVal, totalVal, frac, animKey }) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    let raf2;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setOn(true)); });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [animKey]);
  const green = frac * 100;
  return (
    <div style={S.barTrack}>
      {/* left-to-right reveal: a window slides in while the bar inside slides the opposite way, so the bar
          stays put and is uncovered from the left. Both are GPU transforms — no relayout or repaint per frame. */}
      <div style={{ flex: "1 1 100%", width: "100%", height: "100%", overflow: "hidden", transform: on ? "translate3d(0,0,0)" : "translate3d(-100%,0,0)",
                    transition: on ? "transform .62s cubic-bezier(0.32,0.72,0.24,1)" : "none" }}>
      <div style={{ width: "100%", height: "100%", display: "flex", transform: on ? "translate3d(0,0,0)" : "translate3d(100%,0,0)",
                    transition: on ? "transform .62s cubic-bezier(0.32,0.72,0.24,1)" : "none" }}>
        <div style={{ height: "100%", width: `${green}%`, flexShrink: 0, background: remainColor(remainingVal),
                      transition: "width .5s cubic-bezier(0.32,0.72,0.24,1), background .3s ease" }} />
        <div style={{ height: "100%", flex: 1, background: totalVal > 0 ? "#ff5d6c" : "#2c3034",
                      transition: "background .3s ease" }} />
      </div>
      </div>
    </div>
  );
};

const CATS = {
  food: { label: "Food", icon: "fork_spoon" },
  transport: { label: "Transport", icon: "directions_car" },
  shopping: { label: "Shopping", icon: "shopping_bag" },
  bills: { label: "Bills", icon: "receipt_long" },
  other: { label: "Other", icon: "apps" },
};
const CAT_ORDER = ["food", "transport", "shopping", "bills", "other"];

const ICON_CHOICES = [
  "fork_spoon", "restaurant", "local_cafe", "local_pizza", "lunch_dining", "icecream",
  "directions_car", "local_gas_station", "directions_bus", "train", "flight", "local_taxi",
  "shopping_bag", "shopping_cart", "storefront", "checkroom", "redeem", "diamond",
  "receipt_long", "bolt", "water_drop", "wifi", "home", "phone_iphone",
  "medical_services", "fitness_center", "school", "pets", "sports_esports", "movie",
  "music_note", "build", "savings", "apps",
];

const CAT_RULES = {
  food: [
    "makan", "food", "eat", "lunch", "dinner", "breakfast", "brunch", "steak", "coffee", "kopi", "nasi", "ayam", "mie", "noodle", "snack", "restaurant", "resto", "cafe", "kafe", "bakso", "sate", "pizza", "burger", "tea", "teh", "drink", "minum", "sarapan", "warung", "boba", "sushi", "chicken", "rice", "bread", "roti", "cake", "juice", "es ", "dessert", "bakery", "seafood", "ramen", "dimsum", "martabak", "gorengan", "padang", "geprek", "soto", "gado",
    "mcdonald", "mcd", "kfc", "burger king", "wendys", "wendy's", "popeyes", "subway", "dominos", "domino's", "pizza hut", "starbucks", "sbux", "dunkin", "jco", "j.co", "richeese", "hokben", "yoshinoya", "marugame", "solaria", "sederhana", "burger nangor", "blenger", "moon chicken", "wingstop", "shihlin", "kokumi", "auntie anne", "krispy kreme", "chick fil", "five guys", "shake shack", "taco bell", "sushi tei", "genki", "ichiban", "bakmi", "eatlah", "haus", "mixue",
    "chatime", "boost juice", "boost", "teazzi", "chagee", "kopi kenangan", "janji jiwa", "fore", "tomoro", "point coffee", "gong cha", "koi the", "xing fu", "menantea", "es teler", "tiger sugar", "dum dum", "milk tea", "matcha", "smoothie", "bubble tea",
  ],
  transport: [
    "transport", "gojek", "gocar", "goride", "gosend", "grab", "grabcar", "grabbike", "bluebird", "blue bird", "silverbird", "silver bird", "taxi", "taksi", "uber", "maxim", "indriver",
    "bensin", "pertamax", "pertalite", "shell", "fuel", "petrol", "gasoline", "spbu",
    "parkir", "parking", "tol", "toll", "emoney", "e-money", "e money", "flazz", "brizzi", "tapcash",
    "bus", "busway", "transjakarta", "train", "kereta", "krl", "mrt", "lrt", "commuter", "ojek", "flight", "pesawat", "tiket", "airport", "bandara", "damri", "angkot", "commute", "tambal ban",
  ],
  shopping: [
    "shop", "belanja", "baju", "clothes", "shirt", "kaos", "celana", "jacket", "jaket", "shoes", "sepatu", "sandal", "tokopedia", "shopee", "lazada", "blibli", "amazon", "tiktok shop", "mall", "beli", "gift", "hadiah", "bag", "tas", "makeup", "skincare", "parfum", "uniqlo", "zara", "h&m", "nike", "adidas", "muji", "ikea",
    "alfamart", "alfamidi", "indomaret", "lawson", "family mart", "familymart", "circle k", "circlek", "minimarket", "convenience store",
    "lego", "bearbrick", "be@rbrick", "kaws", "gunpla", "gundam", "figure", "figurine", "funko", "pop mart", "popmart", "labubu", "smiski", "sonny angel", "hot wheels", "hotwheels", "pokemon card", "trading card", "vinyl", "sneaker", "collectible", "keyboard", "mousepad", "headset", "console", "nintendo", "playstation", "steam",
  ],
  bills: [
    "bill", "tagihan", "listrik", "electric", "electricity", "pln", "token listrik", "water", "air pam", "pdam", "gas", "lpg", "elpiji", "internet", "wifi", "indihome", "biznet", "firstmedia", "pulsa", "kuota", "paket data", "telkomsel", "indosat",
    "rent", "sewa", "kos", "kontrakan", "mortgage", "kpr", "subscription", "langganan", "insurance", "asuransi", "bpjs", "spotify", "netflix", "youtube premium", "icloud", "google one", "cicilan", "loan", "angsuran", "tax", "pajak", "iuran", "spp", "tuition",
  ],
};

const inferCat = (desc) => {
  const d = (desc || "").toLowerCase().trim();
  if (!d) return null;
  for (const cat of ["food", "transport", "shopping", "bills"]) {
    if (CAT_RULES[cat].some((w) => d.includes(w))) return cat;
  }
  return null;
};

const HamburgerIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16">
    <rect className="hl l1" x="2" y="3.2" width="12" height="1.7" rx="0.85" fill="currentColor" />
    <rect className="hl l2" x="2" y="7.15" width="12" height="1.7" rx="0.85" fill="currentColor" />
    <rect className="hl l3" x="2" y="11.1" width="12" height="1.7" rx="0.85" fill="currentColor" />
  </svg>
);

const CAT_HOVER_ICON = {
  income: "money",
  food: "fork_spoon",
  transport: "directions_bus",
  shopping: "shopping_bag",
  bills: "receipt",
  other: "grid_view",
};

const CAT_COLORS = {
  income: "#5ad2a6", food: "#ff8fa3", transport: "#7cc9ff",
  shopping: "#c49bff", bills: "#ffd069", other: "#a9b6c9", left: "#7fd8b4",
};

/* Title reel — scrolls through the five category icons only */
const TITLE_SLOT = 26;
const CatTitleReel = ({ cat }) => {
  const idx = Math.max(0, CAT_ORDER.indexOf(cat));
  const prev = useRef(idx);
  const [blur, setBlur] = useState(false);
  const dist = Math.max(1, Math.abs(idx - prev.current));
  useEffect(() => {
    if (prev.current !== idx) { setBlur(true); const t = setTimeout(() => setBlur(false), 260); prev.current = idx; return () => clearTimeout(t); }
  }, [idx]);
  const dur = Math.min(0.14 * dist + 0.12, 0.6);
  return (
    <span style={{ width: 24, height: TITLE_SLOT, overflow: "hidden", display: "inline-block", flexShrink: 0 }}>
      <span style={{ display: "block", transform: `translateY(${-idx * TITLE_SLOT}px)`,
                     transition: `transform ${dur}s cubic-bezier(0.45,0,0.2,1), filter .18s ease`,
                     filter: blur ? "blur(2.2px)" : "blur(0px)" }}>
        {CAT_ORDER.map((c) => (
          <span key={c} style={{ height: TITLE_SLOT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="msym" style={{ fontSize: 20, color: CAT_COLORS[c] }}>{CATS[c].icon}</span>
          </span>
        ))}
      </span>
    </span>
  );
};

/* Pretty names: McDonalds, KFC, Burger King … */
const WORD_FIX = {
  mcdonalds: "McDonalds", kfc: "KFC", mcd: "McD", mcdonalds: "McDonalds", mcdonald: "McDonald", jco: "J.CO", "j.co": "J.CO",
  hokben: "HokBen", mrt: "MRT", lrt: "LRT", krl: "KRL", spbu: "SPBU", pln: "PLN", pdam: "PDAM",
  bpjs: "BPJS", lpg: "LPG", kpr: "KPR", atm: "ATM", kaws: "KAWS", lego: "LEGO", ikea: "IKEA",
  "h&m": "H&M", tcg: "TCG", ac: "AC", tv: "TV", ps5: "PS5", ps4: "PS4", id: "ID", bca: "BCA",
  bri: "BRI", bni: "BNI", ovo: "OVO", gopay: "GoPay", gojek: "Gojek", grabfood: "GrabFood",
  gofood: "GoFood", grabcar: "GrabCar", goride: "GoRide", be: "Be", "be@rbrick": "Be@rbrick",
};
/* Variants that should be counted as the same thing in the breakdown lists. */
const CANON = {
  // food
  snack: "snacks", snacks: "snacks", cemilan: "snacks", jajan: "snacks",
  mcd: "mcdonalds", mcdonald: "mcdonalds", mcdonalds: "mcdonalds", "mc donalds": "mcdonalds",
  "mc d": "mcdonalds", macd: "mcdonalds", mekdi: "mcdonalds",
  kfc: "kfc", "k f c": "kfc",
  bk: "burger king", "burger king": "burger king",
  sbux: "starbucks", starbuck: "starbucks", starbucks: "starbucks",
  kopi: "coffee", cofee: "coffee", coffe: "coffee", coffee: "coffee",
  makan: "food", makanan: "food", food: "food", eat: "food",
  minum: "drinks", minuman: "drinks", drink: "drinks", drinks: "drinks",
  lunch: "lunch", makansiang: "lunch",
  dinner: "dinner", makanmalam: "dinner",
  breakfast: "breakfast", sarapan: "breakfast",
  bobba: "boba", boba: "boba", "bubble tea": "boba",
  // transport
  gojek: "gojek", goride: "gojek", gocar: "gojek", gosend: "gojek",
  grab: "grab", grabbike: "grab", grabcar: "grab",
  bensin: "fuel", fuel: "fuel", petrol: "fuel", gas: "fuel", pertamax: "fuel", pertalite: "fuel",
  parkir: "parking", parking: "parking",
  tol: "toll", toll: "toll",
  taxi: "taxi", taksi: "taxi",
  // shopping / convenience
  alfamart: "convenience store", indomaret: "convenience store", lawson: "convenience store",
  "family mart": "convenience store", familymart: "convenience store", circlek: "convenience store",
  "circle k": "convenience store", minimarket: "convenience store", alfamidi: "convenience store",
  belanja: "shopping", shopping: "shopping", shop: "shopping",
  baju: "clothes", clothes: "clothes", clothing: "clothes",
  sepatu: "shoes", shoes: "shoes", sneakers: "shoes", sneaker: "shoes",
  // bills
  listrik: "electricity", electricity: "electricity", electric: "electricity",
  wifi: "internet", internet: "internet",
  pulsa: "phone credit", kuota: "phone credit",
};
const canonKey = (raw) => {
  const k = (raw || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/[.'’]/g, "");
  if (!k) return "__none__";
  if (CANON[k]) return CANON[k];
  const singular = k.endsWith("s") && k.length > 3 ? k.slice(0, -1) : null;
  if (singular && CANON[singular]) return CANON[singular];
  return k;
};

const prettyName = (raw) => {
  const s = (raw || "").trim();
  if (!s) return "No description";
  return s.split(/\s+/).map((w) => {
    const lw = w.toLowerCase();
    if (WORD_FIX[lw]) return WORD_FIX[lw];
    if (/^mc[a-z]/.test(lw)) return "Mc" + lw.charAt(2).toUpperCase() + lw.slice(3);
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
};

const REEL = ["menu", ...CAT_ORDER]; // menu, food, transport, shopping, bills, other
const SLOT = 22;

/* Vertical reel: switching categories scrolls through the icons in order,
   passing every icon in between. Defined outside so transitions persist. */
const CatReel = ({ cat, customIcon }) => {
  const idx = customIcon ? REEL.length : (cat ? REEL.indexOf(cat) : 0);
  const prev = useRef(idx);
  const dist = Math.max(1, Math.abs(idx - prev.current));
  useEffect(() => { prev.current = idx; }, [idx]);
  const dur = Math.min(0.13 * dist + 0.12, 0.72);
  return (
    <span style={{ position: "relative", width: 20, height: SLOT, overflow: "hidden", display: "block" }}>
      <span style={{ display: "block", transform: `translateY(${-idx * SLOT}px)`, transition: `transform ${dur}s cubic-bezier(0.45,0,0.2,1)` }}>
        {REEL.map((k) => (
          <span key={k} style={{ height: SLOT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {k === "menu" ? <HamburgerIcon /> : <span className="msym" style={{ fontSize: 17, color: "#c7cdd2" }}>{CATS[k].icon}</span>}
          </span>
        ))}
        <span style={{ height: SLOT, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {customIcon ? <span className="msym" style={{ fontSize: 17, color: "#e3b341" }}>{customIcon}</span> : null}
        </span>
      </span>
    </span>
  );
};

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <rect className="pi-h" x="2.5" y="7" width="11" height="2" rx="1" fill="currentColor" />
    <rect className="pi-v" x="7" y="2.5" width="2" height="11" rx="1" fill="currentColor" />
  </svg>
);
const MinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <rect className="pi-h" x="2.5" y="7" width="11" height="2" rx="1" fill="currentColor" />
  </svg>
);

export default function PnlCalendar() {
  const now = new Date();
  // re-render just after midnight so "today" (outline, weekly chart, insights) never goes stale while the app is open
  const [dayTick, setDayTick] = useState(0);
  useEffect(() => {
    const n = new Date();
    const ms = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5) - n;
    const t = setTimeout(() => setDayTick((x) => x + 1), ms);
    return () => clearTimeout(t);
  }, [dayTick]);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState("year");
  const [launched, setLaunched] = useState(false);
  const [launchExit, setLaunchExit] = useState(false);
  const [yearIntro, setYearIntro] = useState(false);   // plays the big-year opening animation
  const [yearRise, setYearRise] = useState(false);
  const [fromYear, setFromYear] = useState(false);   // month view opened from the year panel     // rise-in for the header year (month -> year)
  const [introMove, setIntroMove] = useState(false);   // second half: travel to the header slot
  const [introTarget, setIntroTarget] = useState(null);
  const introTextRef = useRef(null);
  const headerYearRef = useRef(null);
  const [yearShift, setYearShift] = useState(false);   // motion blur while switching years
  const [currency, setCurrency] = useState("IDR");
  const [spending, setSpending] = useState({});
  const [incomes, setIncomes] = useState({});
  const [limits, setLimits] = useState({});
  const [selected, setSelected] = useState(null);
  const [newAmt, setNewAmt] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIncAmt, setNewIncAmt] = useState("");
  const [newIncDesc, setNewIncDesc] = useState("");
  const [incomeDraft, setIncomeDraft] = useState("");
  const [showIncomeList, setShowIncomeList] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [chartClosing, setChartClosing] = useState(false);
  const [chartMode, setChartMode] = useState("both");
  const [panelClosing, setPanelClosing] = useState(false);
  const [panelAnim, setPanelAnim] = useState(false);
  const [catView, setCatView] = useState(null); // category id shown in the breakdown modal
  const [catViewClosing, setCatViewClosing] = useState(false);
  const [hoverBtn, setHoverBtn] = useState(null);
  const [suppressBtn, setSuppressBtn] = useState(null);
  const [flowOpen, setFlowOpen] = useState(true);
  const [flowClosing, setFlowClosing] = useState(false);
  const [flowRun, setFlowRun] = useState(0);
  const [flowSeen, setFlowSeen] = useState(false);
  const flowCardRef = useRef(null);
  const [weekSeen, setWeekSeen] = useState(false);
  /* goals: global savings targets that carry across every month */
  const [goals, setGoals] = useState([]);
  const [goalsSeen, setGoalsSeen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(true);
  const [goalsClosing, setGoalsClosing] = useState(false);
  const [goalsRun, setGoalsRun] = useState(0);
  const goalsCardRef = useRef(null);
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [fundGoal, setFundGoal] = useState(null);
  const [fundAmt, setFundAmt] = useState("");
  const [goalLeaving, setGoalLeaving] = useState(null);
  /* insights drop-down inside money flow */
  const [insOpen, setInsOpen] = useState(false);
  const [insClosing, setInsClosing] = useState(false);
  const [insRun, setInsRun] = useState(0);
  const [weekOpen, setWeekOpen] = useState(true);
  const [weekClosing, setWeekClosing] = useState(false);
  const [weekRun, setWeekRun] = useState(0);
  const [weekHover, setWeekHover] = useState(null);
  const weekCardRef = useRef(null);
  const [removing, setRemoving] = useState({});
  const [hoverPt, setHoverPt] = useState(null);
  const [catMenu, setCatMenu] = useState(null); // { id, stage: 'cats'|'other'|'icons', closing }
  const [otherDesc, setOtherDesc] = useState("");
  const [aiCats, setAiCats] = useState({}); // id -> category from AI
  const aiTried = useRef({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const isMYR = currency === "MYR";
  const fmt = (n) => {
    const neg = n < 0;
    let v = Math.abs(n);
    if (isMYR) {
      const rm = v / MYR_RATE;
      let s;
      if (rm >= 1_000_000) s = (Math.floor((rm / 1_000_000) * 100) / 100).toString().replace(".", ",") + "M";
      else if (rm >= 1_000) s = (Math.floor((rm / 1_000) * 10) / 10).toString().replace(".", ",") + "k";
      else s = oneDp(rm);                              // e.g. 11.49 → 11.5, 11 → 11.0
      return (neg && s !== "0.0" ? "-" : "") + s;
    }
    v = Math.floor(v);
    let s;
    if (v >= 1_000_000) s = (Math.floor((v / 1_000_000) * 100) / 100).toString().replace(".", ",") + "jt";
    else if (v >= 1_000) s = (Math.floor((v / 1_000) * 10) / 10).toString().replace(".", ",") + "Rb";
    else s = String(v);
    return (neg ? "-" : "") + s;
  };
  const fmtCoarse = (n) => {
    const neg = n < 0;
    let v = Math.abs(n);
    if (isMYR) v = Math.floor(v / MYR_RATE);
    v = Math.floor(v);
    let str;
    if (v >= 1_000_000) str = Math.floor(v / 1_000_000) + (isMYR ? "M" : "jt");
    else if (v >= 1_000) str = Math.floor(v / 1_000) + (isMYR ? "k" : "Rb");
    else str = String(v);
    return (neg ? "-" : "") + str;
  };
  // Counting matches the resting format, so the unit flips at the 1jt boundary.
  // If neither end of the run has a decimal, the whole animation stays decimal-free.
  const fmtLive = (n, busy, span) => {
    if (busy && span) {
      const a = fmt(span.from), b = fmt(span.to);
      if (!/[,.]/.test(a) && !/[,.]/.test(b)) return fmtCoarse(n);
    }
    return fmt(n);
  };
  const cur = isMYR ? "RM" : "Rp";
  const toDisp = (idr) => (isMYR ? Math.floor(idr / MYR_RATE) : idr);
  // income chips / totals: RM with one decimal, Rp as before
  const chipAmt = (idr) => (isMYR ? oneDp(idr / MYR_RATE) : idr.toLocaleString("id-ID"));
  const toIDR = (disp) => (isMYR ? Math.round(disp * MYR_RATE) : disp);
  // parse whatever is typed in the active currency into rupiah
  const amtToIDR = (str) => {
    if (!isMYR) return parseNum(str);
    const v = parseFloat(String(str).replace(/,/g, ".").replace(/[^\d.]/g, ""));
    return isNaN(v) ? 0 : Math.min(Math.round(v * MYR_RATE), MAX_AMOUNT);
  };
  const dispStr = (idr) => (!idr ? "" : isMYR ? (idr / MYR_RATE).toFixed(2) : idr.toLocaleString("id-ID"));

  const mKey = monthKeyOf(year, month);
  const dailyLimit = limits[mKey] || DEFAULT_LIMIT;
  const monthIncomes = incomes[mKey] || [];
  const sortedIncomes = useMemo(() => [...monthIncomes].sort((a, b) => b.amount - a.amount), [monthIncomes]);
  const chipRefs = useRef({});
  const chipPos = useRef({});
  useLayoutEffect(() => {
    const ids = new Set(sortedIncomes.map((it) => it.id));
    // drop bookkeeping for chips that no longer exist so the rest don't jump
    Object.keys(chipPos.current).forEach((id) => { if (!ids.has(id)) delete chipPos.current[id]; });
    Object.keys(chipRefs.current).forEach((id) => { if (!ids.has(id)) delete chipRefs.current[id]; });

    sortedIncomes.forEach((it) => {
      const node = chipRefs.current[it.id];
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const prev = chipPos.current[it.id];
      if (prev && (prev.left !== rect.left || prev.top !== rect.top)) {
        const dx = prev.left - rect.left;
        const dy = prev.top - rect.top;
        node.style.transition = "none";
        node.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          node.style.transition = "transform .3s cubic-bezier(0.22,0.9,0.25,1)";
          node.style.transform = "translate(0px, 0px)";
        });
      }
      chipPos.current[it.id] = { left: rect.left, top: rect.top };
    });
  }, [sortedIncomes, showIncomeList, currency]);

  const totalIncome = monthIncomes.reduce((s, it) => s + it.amount, 0);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const todayNum = isCurrentMonth ? now.getDate() : -1;

  useEffect(() => {
    (async () => {
      try {
        const res = await store.get(STORE_KEY);
        if (res && res.value) {
          const data = JSON.parse(res.value);
          setSpending(migrateSpending(data.spending || {}));
          setLimits(data.limits || {});
          if (data.currency) setCurrency(data.currency);
          let inc = data.incomes || {};
          if (!data.incomes && data.monthlyIncome) {
            inc = { [monthKeyOf(now.getFullYear(), now.getMonth())]: [{ id: uid(), amount: data.monthlyIncome, desc: "", day: null }] };
          }
          setIncomes(migrateIncomes(inc));
          if (Array.isArray(data.goals)) setGoals(data.goals);
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  /* Saving: every call merges into the newest known data (never a stale snapshot from an older render),
     writes run strictly in order, and a failed write is shown to the user instead of being swallowed. */
  const latestData = useRef(null);
  latestData.current = { spending, incomes, limits, currency, goals, ...(latestData.pending || {}) };
  const saveChain = useRef(Promise.resolve());
  const [saveError, setSaveError] = useState(false);
  const persist = (next = {}) => {
    latestData.pending = { ...(latestData.pending || {}), ...next };
    const snapshot = JSON.stringify({ ...latestData.current, ...latestData.pending });
    setSaving(true);
    saveChain.current = saveChain.current.then(async () => {
      try { await store.set(STORE_KEY, snapshot); setSaveError(false); }
      catch (e) { console.error(e); setSaveError(true); }
    });
    const mine = saveChain.current;
    return mine.then(() => { if (saveChain.current === mine) { setSaving(false); latestData.pending = null; } });
  };

  /* ---------- backup: export / import the whole dataset ---------- */
  const fileRef = useRef(null);
  const [backupMsg, setBackupMsg] = useState("");

  const exportData = () => {
    const blob = new Blob([JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      spending, incomes, limits, currency, goals,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    a.href = url;
    a.download = `pnl-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setBackupMsg("Backup downloaded");
    setTimeout(() => setBackupMsg(""), 2600);
  };

  const [undoImport, setUndoImport] = useState(null);      // previous data, kept briefly after an import
  const msgTimer = useRef(0);
  const flashBackup = (m, ms = 3000) => { clearTimeout(msgTimer.current); setBackupMsg(m); msgTimer.current = setTimeout(() => setBackupMsg(""), ms); };
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const applyData = async (d) => {
    setGoals(d.goals); setSpending(d.spending); setIncomes(d.incomes); setLimits(d.limits); setCurrency(d.currency);
    await persist(d);
  };
  const importData = async (file) => {
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { flashBackup("Could not read that file"); return; }
    // only accept something that actually looks like a backup from this app — never wipe data with a random file
    const looksRight = isObj(data) && (isObj(data.spending) || isObj(data.incomes))
      && (data.spending === undefined || isObj(data.spending)) && (data.incomes === undefined || isObj(data.incomes))
      && (data.limits === undefined || isObj(data.limits)) && (data.goals === undefined || Array.isArray(data.goals));
    if (!looksRight) { flashBackup("That isn't a PnL backup file, nothing was changed", 4000); return; }
    const prev = { spending, incomes, limits, currency, goals };
    const next = {
      spending: migrateSpending(data.spending || {}),
      incomes: migrateIncomes(data.incomes || {}),
      limits: data.limits || {},
      currency: data.currency === "MYR" || data.currency === "IDR" ? data.currency : currency,
      goals: (data.goals || []).filter((g) => isObj(g) && g.id && typeof g.name === "string")
        .map((g) => ({ ...g, target: Number(g.target) || 0, deposits: Array.isArray(g.deposits) ? g.deposits.filter((x) => isObj(x) && typeof x.amount === "number") : [] })),
    };
    await applyData(next);
    setUndoImport(prev);
    flashBackup("Backup restored", 10000);
    setTimeout(() => setUndoImport((u) => (u === prev ? null : u)), 10000);
  };
  const revertImport = async () => {
    if (!undoImport) return;
    const prev = undoImport;
    setUndoImport(null);
    await applyData(prev);
    flashBackup("Import undone");
  };

  /* ---------- test data (for trying the app out) ----------
     Adds to what's there, never replaces. Every generated entry carries test: true
     so "Clear test data" can remove exactly those and nothing else. */
  const TEST_SMALL = [["Chatime", "food"], ["Kopi Kenangan", "food"], ["Nasi padang", "food"], ["McDonald's", "food"],
    ["Makan siang", "food"], ["Mixue", "food"], ["Grab", "transport"], ["Gojek", "transport"], ["MRT", "transport"],
    ["Parkir", "transport"], ["Indomaret", "shopping"], ["Snack", "food"]];
  const TEST_MID = [["Dinner", "food"], ["Sushi Tei", "food"], ["Bensin", "transport"], ["Uniqlo", "shopping"],
    ["Pulsa", "bills"], ["Wingstop", "food"], ["Starbucks", "food"], ["Grab", "transport"]];
  const TEST_BIG = [["Electricity", "bills"], ["Lego", "shopping"], ["Groceries", "shopping"], ["Internet", "bills"],
    ["Shoes", "shopping"], ["Water bill", "bills"]];
  const [testMsg, setTestMsg] = useState("");
  const flashTest = (m) => { setTestMsg(m); setTimeout(() => setTestMsg(""), 2800); };

  /* ---- test-data settings (double-click "Add test data") ---- */
  const [testCfg, setTestCfg] = useState(DEFAULT_TEST_CFG);
  const [cfgDraft, setCfgDraft] = useState(null);           // non-null while the pop-up is open
  const [cfgClosing, setCfgClosing] = useState(false);
  const testClickTimer = useRef(0);
  useEffect(() => { (async () => {
    try { const r = await store.get(TEST_CFG_KEY); if (r?.value) setTestCfg({ ...DEFAULT_TEST_CFG, ...JSON.parse(r.value) }); } catch (e) {}
  })(); }, []);
  // single click adds with the saved settings; a double click opens the settings instead of adding twice
  const onTestDataClick = (e) => {
    clearTimeout(testClickTimer.current);
    if (e.detail >= 2) { openTestCfg(); return; }
    testClickTimer.current = setTimeout(() => addTestData(testCfg), 260);
  };
  const openTestCfg = () => { setCfgClosing(false); setCfgDraft({ ...testCfg, incMinStr: String(testCfg.incMin), incMaxStr: String(testCfg.incMax) }); };
  const closeTestCfg = () => { setCfgClosing(true); setTimeout(() => { setCfgDraft(null); setCfgClosing(false); }, 230); };
  const cfgNum = (str) => { const v = parseFloat(String(str).replace(",", ".")); return isNaN(v) ? null : Math.max(0, Math.min(1000, v)); };
  const cfgValid = (d) => { const a = cfgNum(d.incMinStr), b = cfgNum(d.incMaxStr); return a !== null && b !== null && a > 0 && b >= a; };
  const runTestCfg = async () => {
    const d = cfgDraft;
    if (!d || !cfgValid(d)) return;
    const cfg = { incMin: cfgNum(d.incMinStr), incMax: cfgNum(d.incMaxStr), incFreq: d.incFreq, incTiming: d.incTiming, style: d.style, range: d.range, goals: d.goals };
    setTestCfg(cfg);
    try { await store.set(TEST_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
    closeTestCfg();
    await addTestData(cfg);
  };

  const addTestData = async (cfg = testCfg) => {
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const st = SPEND_STYLES[cfg.style] || SPEND_STYLES.balanced;
    const nextSp = { ...spending }, nextInc = { ...incomes };
    const ty = year;
    const mFrom = cfg.range === "month" || cfg.range === "rest" ? month : 0;
    const mTo = cfg.range === "month" ? month : 11;
    let nE = 0, nI = 0, nZ = 0;
    for (let m = mFrom; m <= mTo; m++) {
      const dim = new Date(ty, m + 1, 0).getDate();
      // income: amount range (jt) and frequency from the settings
      const mk = monthKeyOf(ty, m);
      const incs = [...(nextInc[mk] || [])];
      const nInc = cfg.incFreq === "1" ? 1 : cfg.incFreq === "2-3" ? rnd(2, 3) : cfg.incFreq === "weekly" ? 4 : rnd(1, 2);
      const lo = Math.round(cfg.incMin * 10), hi = Math.round(cfg.incMax * 10);            // in 100Rb steps
      for (let k = 0; k < nInc; k++) {
        const day = cfg.incFreq === "weekly" ? Math.min(dim, 1 + k * 7 + rnd(0, 2))
                  : cfg.incTiming === "spread" ? rnd(1, dim) : rnd(1, 3);
        incs.push({ id: uid(), amount: rnd(lo, hi) * 100_000, desc: cfg.incFreq === "weekly" ? "Weekly pay" : k === 0 ? "Salary" : pick(["Freelance", "Side project", "Bonus"]), day, test: true });
        nI++;
      }
      nextInc[mk] = incs;
      // big days for this style
      const bigDays = new Set();
      const nBig = rnd(st.big[0], st.big[1]);
      while (bigDays.size < Math.min(nBig, dim)) bigDays.add(rnd(1, dim));
      const swing = st.monthSwing ? st.monthSwing[0] + Math.random() * (st.monthSwing[1] - st.monthSwing[0]) : 1;
      for (let d = 1; d <= dim; d++) {
        const k0 = keyOf(ty, m, d);
        const add = [];
        const dow = new Date(ty, m, d).getDay(), wkend = dow === 0 || dow === 6;
        const mult = swing * (wkend ? st.weekend : 1) * (st.spike && Math.random() < st.spike ? rnd(3, 6) : 1);
        const amt = (a, b) => Math.round((rnd(a, b) * mult)) * 1000;
        if (Math.random() < st.small[0]) { const [desc, cat] = pick(TEST_SMALL); add.push({ amount: amt(st.small[1], st.small[2]), desc, cat }); }
        if (Math.random() < (wkend && st.weekendMid ? st.weekendMid : st.mid[0])) { const [desc, cat] = pick(TEST_MID); add.push({ amount: amt(st.mid[1], st.mid[2]), desc, cat }); }
        if (bigDays.has(d)) { const [desc, cat] = pick(TEST_BIG); add.push({ amount: rnd(st.big[2], st.big[3]) * 1000, desc, cat }); }
        if (!add.length) {
          // nothing spent this day → mark it as a no-spend day (unless it already has entries)
          if (!(nextSp[k0] || []).length) {
            nextSp[k0] = [{ id: uid(), amount: 0, desc: "No spend day", zero: true, test: true }];
            nZ++;
          }
          continue;
        }
        const k = keyOf(ty, m, d);
        nextSp[k] = [...(nextSp[k] || []).filter((it) => !it.zero), ...add.map((it) => ({ id: uid(), ...it, test: true }))];
        nE += add.length;
      }
    }
    // goals: monthly deposits from January up to this month (or the whole year if it's a future year)
    const lastM = ty < now.getFullYear() ? 11 : ty === now.getFullYear() ? now.getMonth() : 11;
    if (!cfg.goals) {
      setSpending(nextSp); setIncomes(nextInc);
      await persist({ spending: nextSp, incomes: nextInc });
      flashTest(`Added ${nE} expenses, ${nZ} no-spend days, ${nI} incomes (${st.label.toLowerCase()})`);
      return;
    }
    const plans = [
      { name: "Emergency fund", target: 20_000_000, lo: 800, hi: 1_500 },
      { name: "Japan trip",     target: 12_000_000, lo: 900, hi: 1_600 },
      { name: "New MacBook",    target: 28_000_000, lo: 300, hi: 900 },
      { name: "House down payment", target: 150_000_000, lo: 1_000, hi: 3_000, skip: 0.3 },
    ];
    const newGoals = plans.map((pl) => {
      const deposits = [];
      let saved = 0;
      for (let m = 0; m <= lastM && saved < pl.target; m++) {
        if (pl.skip && Math.random() < pl.skip) continue;
        const amt = Math.min(pl.target - saved, rnd(pl.lo, pl.hi) * 1000 * 1);
        const a = Math.round(amt / 50_000) * 50_000 || amt;
        deposits.push({ id: uid(), amount: a, date: keyOf(ty, m, rnd(3, 10)), test: true });
        saved += a;
        // the odd withdrawal, like real life
        if (m > 2 && Math.random() < 0.08 && saved > 1_000_000) {
          const w = rnd(3, 8) * 100_000;
          deposits.push({ id: uid(), amount: -w, date: keyOf(ty, m, rnd(15, 25)), test: true });
          saved -= w;
        }
      }
      return { id: uid(), name: pl.name, target: pl.target, deposits, test: true };
    });
    const nextGoals = [...goals, ...newGoals];
    setSpending(nextSp); setIncomes(nextInc); setGoals(nextGoals);
    await persist({ spending: nextSp, incomes: nextInc, goals: nextGoals });
    flashTest(`Added ${nE} expenses, ${nZ} no-spend days, ${nI} incomes, ${newGoals.length} goals (${st.label.toLowerCase()})`);
  };

  const clearTestData = async () => {
    const nextSp = {}, nextInc = {};
    let n = 0;
    Object.entries(spending).forEach(([k, arr]) => {
      const keep = arr.filter((it) => !it.test); n += arr.length - keep.length;
      if (keep.length) nextSp[k] = keep;
    });
    Object.entries(incomes).forEach(([k, arr]) => {
      const keep = arr.filter((it) => !it.test); n += arr.length - keep.length;
      if (keep.length) nextInc[k] = keep;
    });
    const nextGoals = goals.filter((g) => !g.test).map((g) => ({ ...g, deposits: (g.deposits || []).filter((d) => !d.test) }));
    n += goals.length - goals.filter((g) => !g.test).length;
    setSpending(nextSp); setIncomes(nextInc); setGoals(nextGoals);
    await persist({ spending: nextSp, incomes: nextInc, goals: nextGoals });
    flashTest(n ? `Removed ${n} test entries` : "No test data to remove");
  };

  const [goalIconMenu, setGoalIconMenu] = useState(null);   // goal id whose picker is open
  const [aiGoalIcons, setAiGoalIcons] = useState({});
  const aiGoalTried = useRef({});
  const goalIconOf = (g) => g.icon || inferGoalIcon(g.name) || aiGoalIcons[g.id] || "savings";
  const setGoalIcon = (id, icon) => {
    const next = goals.map((g) => (g.id === id ? { ...g, icon: icon || undefined } : g));
    setGoals(next); persist({ goals: next }); setGoalIconMenu(null);
  };
  // names the keyword list can't place → ask the model to pick from the icon set
  useEffect(() => {
    if (!AI_OK) return;
    goals.forEach(async (g) => {
      if (g.icon || inferGoalIcon(g.name) || aiGoalIcons[g.id] || aiGoalTried.current[g.id]) return;
      aiGoalTried.current[g.id] = true;
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 50,
            messages: [{ role: "user", content: `Pick the single best icon for this savings goal from this list: ${GOAL_ICONS.join(", ")}. Reply with ONLY the icon name.\n\nGoal: "${g.name}"` }],
          }),
        });
        const data = await res.json();
        const text = (data.content || []).map((c) => c.text || "").join("").trim().toLowerCase();
        const icon = GOAL_ICONS.find((ic) => text.includes(ic));
        if (icon) setAiGoalIcons((m) => ({ ...m, [g.id]: icon }));
      } catch (e) { /* offline: keep the default */ }
    });
  }, [goals]);
  useEffect(() => {
    if (!goalIconMenu) return;
    const close = (e) => { if (!e.target.closest?.(".goal-sym-wrap")) setGoalIconMenu(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [goalIconMenu]);

  const [editingGoal, setEditingGoal] = useState(null);   // goal id being renamed
  const [editGoalName, setEditGoalName] = useState("");
  const [doneOpen, setDoneOpen] = useState(false);          // completed-goals drop-down
  const [doneMounted, setDoneMounted] = useState(false);    // rows stay mounted until the collapse finishes
  const doneTimer = useRef(0);
  const toggleDone = () => {
    clearTimeout(doneTimer.current);
    if (doneOpen) { setDoneOpen(false); doneTimer.current = setTimeout(() => setDoneMounted(false), 380); }
    else { setDoneMounted(true); requestAnimationFrame(() => setDoneOpen(true)); }
  };
  const startRename = (g) => { setEditingGoal(g.id); setEditGoalName(g.name); };
  const commitRename = () => {
    const id = editingGoal, name = editGoalName.trim();
    setEditingGoal(null);
    if (!id || !name) return;
    const next = goals.map((g) => (g.id === id ? { ...g, name } : g));
    setGoals(next); persist({ goals: next });
  };

  const goalSaved = (g) => Math.max(0, (g.deposits || []).reduce((sum, d) => sum + d.amount, 0));
  const addGoal = () => {
    const name = newGoalName.trim();
    const target = amtToIDR(newGoalTarget);
    if (!name || !target) return;
    const next = [...goals, { id: uid(), name, target, deposits: [] }];
    setGoals(next); persist({ goals: next });
    setNewGoalName(""); setNewGoalTarget(""); setNewGoalOpen(false);
  };
  // deposits land on today when viewing this month, otherwise on the selected (or last) day of the viewed month
  const depositDate = () => {
    if (year === now.getFullYear() && month === now.getMonth()) return keyOf(year, month, now.getDate());
    return keyOf(year, month, selected ?? new Date(year, month + 1, 0).getDate());
  };
  const moveGoalFunds = (id, sign) => {
    let amt = amtToIDR(fundAmt);
    if (!amt) return;
    const next = goals.map((g) => {
      if (g.id !== id) return g;
      if (sign < 0) amt = Math.min(amt, goalSaved(g));
      if (!amt) return g;
      return { ...g, deposits: [...(g.deposits || []), { id: uid(), amount: sign * amt, date: depositDate() }] };
    });
    setGoals(next); persist({ goals: next });
    setFundAmt("");
  };
  const deleteGoal = (id) => {
    setGoalLeaving(id);
    setTimeout(() => {
      setGoals((cur) => { const next = cur.filter((g) => g.id !== id); persist({ goals: next }); return next; });
      setGoalLeaving(null);
      if (fundGoal === id) setFundGoal(null);
    }, 260);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthLabel = `${MONTHS_SHORT[month]} ${year}`;
  const monthLabelFull = `${MONTHS_FULL[month]} ${year}`;

  const dayTotal = (d) => (spending[keyOf(year, month, d)] || []).reduce((s, it) => s + it.amount, 0);

  const stats = useMemo(() => {
    let spent = 0, greenDays = 0, greenSum = 0, redDays = 0, redSum = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const items = spending[keyOf(year, month, d)];
      if (!items || items.length === 0) continue;
      const sp = items.reduce((s, it) => s + it.amount, 0);
      spent += sp;
      const pnl = dailyLimit - sp;
      if (pnl >= 0) { greenDays++; greenSum += pnl; }
      else { redDays++; redSum += pnl; }
    }
    return { spent, greenDays, greenSum, redDays, redSum, pnl: greenSum + redSum };
  }, [spending, year, month, daysInMonth, dailyLimit]);

  const statsForYear = (y) => {
    const arr = [];
    let yIncome = 0, ySpent = 0;
    for (let m = 0; m < 12; m++) {
      const dim = new Date(y, m + 1, 0).getDate();
      const lim = limits[monthKeyOf(y, m)] || DEFAULT_LIMIT;
      let spent = 0, pnl = 0, hasData = false;
      for (let d = 1; d <= dim; d++) {
        const items = spending[keyOf(y, m, d)];
        if (!items || items.length === 0) continue;
        hasData = true;
        const sp = items.reduce((s, it) => s + it.amount, 0);
        spent += sp; pnl += lim - sp;
      }
      const inc = (incomes[monthKeyOf(y, m)] || []).reduce((s, it) => s + it.amount, 0);
      yIncome += inc; ySpent += spent;
      arr.push({ spent, pnl, hasData, income: inc });
    }
    return { months: arr, income: yIncome, spent: ySpent };
  };
  const yearStats = useMemo(() => statsForYear(year), [spending, incomes, year, limits]);
  // this year + the next two, every year that holds data, and whichever year is being viewed — never loses old years
  const YEARS = useMemo(() => {
    const ys = new Set([now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2, year]);
    [...Object.keys(spending), ...Object.keys(incomes)].forEach((k) => { const y = parseInt(k.slice(0, 4), 10); if (y > 1900 && y < 3000) ys.add(y); });
    return [...ys].sort((a, b) => a - b);
  }, [spending, incomes, year, dayTick]);
  const allYearStats = useMemo(() => YEARS.map((y) => statsForYear(y)), [spending, incomes, limits, YEARS]);

  const pnlVsPrev = useMemo(() => {
    const pd = new Date(year, month - 1, 1);
    const pm = statsForYear(pd.getFullYear()).months[pd.getMonth()];
    if (!pm.hasData || pm.pnl === 0) return null;
    return { pct: ((stats.pnl - pm.pnl) / Math.abs(pm.pnl)) * 100, name: MONTHS_FULL[pd.getMonth()] };
  }, [spending, limits, year, month, stats.pnl]);

  /* ---------- recap ("wrapped") for a month or a year ---------- */
  const [recap, setRecap] = useState(null);          // { kind: "year" | "month", y, m }
  const [recapClosing, setRecapClosing] = useState(false);
  const openRecap = (r) => { setRecapClosing(false); setRecap(r); };
  const closeRecap = () => {
    setRecapClosing(true);
    setTimeout(() => { setRecap(null); setRecapClosing(false); }, 240);
  };
  useEffect(() => {
    if (!recap) return;
    const onKey = (e) => { if (e.key === "Escape") closeRecap(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recap]);

  const [recapDetail, setRecapDetail] = useState(null);     // "cat:food" | "catbig:food" | "income" | "regular" | "rank"
  const [recapDetailOpen, setRecapDetailOpen] = useState(false);
  const [recapHover, setRecapHover] = useState(null);
  const recapDetailRef = useRef(null);
  useEffect(() => { setRecapDetail(null); setRecapDetailOpen(false); setRecapHover(null); }, [recap]);
  const toggleRecapDetail = (key) => {
    const group = (k) => (k && k.startsWith("cat") ? "cat" : k);
    if (recapDetailOpen && group(recapDetail) === group(key)) { setRecapDetailOpen(false); return; }
    setRecapDetail(key); setRecapDetailOpen(true);
    setTimeout(() => recapDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
  };

  const recapData = useMemo(() => {
    if (!recap) return null;
    const catOf = (it) => { const c = it.cat || inferCat(it.desc) || aiCats[it.id] || "other"; return c in CATS ? c : "other"; };
    const cats = { food: 0, transport: 0, shopping: 0, bills: 0, other: 0 };
    const catItems = { food: {}, transport: {}, shopping: {}, bills: {}, other: {} };
    const places = {}, srcs = {}, txs = [];
    let tx = 0, logged = 0, under = 0, spentTot = 0, incTot = 0;
    const addDay = (y, m, d, lim) => {
      const items = spending[keyOf(y, m, d)] || [];
      if (!items.length) return null;
      let sp = 0;
      items.forEach((it) => {
        sp += it.amount;
        if (it.zero) return;
        const c = catOf(it);
        cats[c] += it.amount; tx++;
        const raw = (it.desc || "").trim();
        const k = raw ? canonKey(raw) : "__none__";
        const name = raw ? prettyName(k) : "No description";
        if (!catItems[c][k]) catItems[c][k] = { name, sum: 0, n: 0 };
        catItems[c][k].sum += it.amount; catItems[c][k].n++;
        if (raw) { if (!places[k]) places[k] = { name, n: 0, sum: 0, cat: c }; places[k].n++; places[k].sum += it.amount; }
        txs.push({ amount: it.amount, name, cat: c, when: `${d} ${MONTHS_SHORT[m]}` });
      });
      logged++; if (sp <= lim) under++; spentTot += sp;
      return sp;
    };
    const addInc = (y, m) => {
      let t = 0;
      (incomes[monthKeyOf(y, m)] || []).forEach((it) => {
        t += it.amount;
        const raw = (it.desc || "").trim();
        const k = raw ? canonKey(raw) : "__none__";
        if (!srcs[k]) srcs[k] = { name: raw ? prettyName(k) : "Unlabelled income", v: 0, n: 0 };
        srcs[k].v += it.amount; srcs[k].n++;
      });
      incTot += t;
      return t;
    };
    const units = [];
    let lim = DEFAULT_LIMIT;
    if (recap.kind === "year") {
      for (let m = 0; m < 12; m++) {
        const l = limits[monthKeyOf(recap.y, m)] || DEFAULT_LIMIT;
        const dim = new Date(recap.y, m + 1, 0).getDate();
        let sp = 0, any = false;
        for (let d = 1; d <= dim; d++) { const v = addDay(recap.y, m, d, l); if (v !== null) { sp += v; any = true; } }
        const inc = addInc(recap.y, m);
        units.push({ i: m, label: MONTHS_FULL[m], short: MONTHS_SHORT[m], value: inc - sp, has: any || inc > 0, inc, sp });
      }
    } else {
      const { y, m } = recap;
      lim = limits[monthKeyOf(y, m)] || DEFAULT_LIMIT;
      addInc(y, m);
      const dim = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= dim; d++) {
        const v = addDay(y, m, d, lim);
        const dow = DOW_FULL[(new Date(y, m, d).getDay() + 6) % 7];
        units.push({ i: d, label: `${dow} ${d}`, sub: `${MONTHS_SHORT[m]} ${y}`, short: String(d), value: v === null ? 0 : lim - v, has: v !== null, sp: v || 0 });
      }
    }
    const active = units.filter((u) => u.has);
    const catRows = CAT_ORDER.map((c) => ({ c, v: cats[c] })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
    const srcList = Object.values(srcs).sort((a, b) => b.v - a.v);
    const placeList = Object.values(places).sort((a, b) => b.n - a.n || b.sum - a.sum);
    const best = active.length ? active.reduce((a, b) => (b.value > a.value ? b : a)) : null;
    const worst = active.length > 1 ? active.reduce((a, b) => (b.value < a.value ? b : a)) : null;
    const total = active.reduce((a, u) => a + u.value, 0);
    const catItemLists = {};
    CAT_ORDER.forEach((c) => { catItemLists[c] = Object.values(catItems[c]).sort((a, b) => b.sum - a.sum); });
    return {
      kind: recap.kind, y: recap.y, m: recap.m, lim,
      empty: active.length === 0,
      units, active: active.length, best, worst, total, avg: active.length ? total / active.length : 0,
      ranked: [...active].sort((a, b) => b.value - a.value),
      catRows, catItemLists, txs, spentTot, incTot, tx, logged, under,
      srcList, placeList,
      src: srcList[0] || null,
      place: placeList[0] && placeList[0].n >= 2 ? placeList[0] : null,
    };
  }, [recap, spending, incomes, limits, aiCats]);

  const remaining = totalIncome - stats.spent;
  const remainFrac = totalIncome > 0 ? Math.max(0, Math.min(1, remaining / totalIncome)) : 0;
  const yearRemaining = yearStats.income - yearStats.spent;
  const yearRemainFrac = yearStats.income > 0 ? Math.max(0, Math.min(1, yearRemaining / yearStats.income)) : 0;

  useEffect(() => {
    if (!yearIntro) { setIntroMove(false); setIntroTarget(null); return; }
    let t1, t2;
    const raf = requestAnimationFrame(() => {
      const a = introTextRef.current?.getBoundingClientRect();
      const b = headerYearRef.current?.getBoundingClientRect();
      if (a && b && a.height > 0 && b.height > 0) {
        setIntroTarget({
          scale: b.height / a.height,
          dx: b.left - a.left,
          dy: (b.top + b.height / 2) - (a.top + a.height / 2),
        });
      }
      t1 = setTimeout(() => setIntroMove(true), 450);          // align, settle, travel
      t2 = setTimeout(() => setYearIntro(false), 855);         // panel appears the moment it lands
    });
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); };
  }, [yearIntro]);

  /* ---------- year stack: one scroll step per year ---------- */
  const yearWrapRef = useRef(null);
  const wheelLock = useRef(false);
  const yearIdx = Math.max(0, YEARS.indexOf(year));
  const stepYear = (dir) => {
    const next = Math.min(YEARS.length - 1, Math.max(0, yearIdx + dir));
    if (next === yearIdx) return;
    setYearShift(true);
    setYear(YEARS[next]);
    setTimeout(() => setYearShift(false), 420);
  };
  useEffect(() => {
    if (!launched || view !== "year") return;
    const el = yearWrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      if (wheelLock.current) return;
      wheelLock.current = true;
      stepYear(e.deltaY > 0 ? 1 : -1);
      setTimeout(() => { wheelLock.current = false; }, 520);
    };
    const onKey = (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      e.preventDefault();
      stepYear(e.key === "ArrowDown" ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => { el.removeEventListener("wheel", onWheel); window.removeEventListener("keydown", onKey); };
  }, [launched, view, yearIdx, YEARS]);

  useEffect(() => {
    if (!launched || view !== "month") return;
    const onKey = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
      if (chartOpen || catView) return;
      e.preventDefault();
      nav(e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [launched, view, year, month, chartOpen, catView]);

  const nav = (dir) => {
    if (view === "year") { setYear(year + dir); return; }
    let m = month + dir, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y); setSelected(null);
  };

  const selKey = selected !== null ? keyOf(year, month, selected) : null;
  const selItems = selKey ? spending[selKey] || [] : [];
  const selIncomes = selected !== null ? monthIncomes.filter((it) => it.day === selected) : [];

  // double-clicking the minus button files a 0Rb "no spend" day
  const addZeroDay = async () => {
    if (selKey === null) return;
    if (selItems.some((it) => it.zero)) return;
    const next = { ...spending, [selKey]: [...selItems, { id: uid(), amount: 0, desc: "No spend day", zero: true }] };
    setSpending(next); setNewAmt(""); setNewDesc("");
    await persist({ spending: next });
  };

  const addExpense = async () => {
    const amt = amtToIDR(newAmt);
    if (!amt) return;
    const next = { ...spending, [selKey]: [...selItems.filter((it) => !it.zero), { id: uid(), amount: amt, desc: newDesc.trim() }] };
    setSpending(next); setNewAmt(""); setNewDesc("");
    await persist({ spending: next });
  };
  const editExpense = (id, field, value) => {
    setSpending({
      ...spending,
      [selKey]: selItems.map((it) => (it.id === id ? { ...it, [field]: field === "amount" ? amtToIDR(value) : value } : it)),
    });
  };
  const deleteExpense = (id) => {
    setRemoving((r) => ({ ...r, [id]: true }));
    setTimeout(async () => {
      const rem = selItems.filter((it) => it.id !== id);
      const next = { ...spending };
      if (rem.length === 0) delete next[selKey]; else next[selKey] = rem;
      setSpending(next);
      setRemoving((r) => { const c = { ...r }; delete c[id]; return c; });
      await persist({ spending: next });
    }, 260);
  };

  // the top box files income against today (or the selected date when browsing
  // another month), so it always shows up as a green dot on the calendar
  const quickIncomeDay = () => {
    if (isCurrentMonth) return todayNum;
    if (selected !== null) return selected;
    return 1;
  };

  const addIncomeEntry = async (amount, desc, day) => {
    if (!amount) return;
    const next = { ...incomes, [mKey]: [...monthIncomes, { id: uid(), amount, desc, day }] };
    setIncomes(next);
    await persist({ incomes: next });
  };
  const editIncome = (id, field, value) => {
    setIncomes({
      ...incomes,
      [mKey]: monthIncomes.map((it) => (it.id === id ? { ...it, [field]: field === "amount" ? amtToIDR(value) : value } : it)),
    });
  };
  // chips in the header list: drop instantly, the FLIP pass slides the rest
  const deleteIncomeNow = async (id) => {
    const rem = monthIncomes.filter((it) => it.id !== id);
    const next = { ...incomes };
    if (rem.length === 0) delete next[mKey]; else next[mKey] = rem;
    setIncomes(next);
    await persist({ incomes: next });
  };

  const deleteIncome = (id) => {
    setRemoving((r) => ({ ...r, [id]: true }));
    setTimeout(async () => {
      const rem = monthIncomes.filter((it) => it.id !== id);
      const next = { ...incomes };
      if (rem.length === 0) delete next[mKey]; else next[mKey] = rem;
      setIncomes(next);
      setRemoving((r) => { const c = { ...r }; delete c[id]; return c; });
      await persist({ incomes: next });
    }, 260);
  };

  /* ---------- categories ---------- */
  const resolvedCat = (it) => it.cat || inferCat(it.desc) || aiCats[it.id] || null;
  const iconOf = (it) => {
    if (it.icon) return it.icon;
    const c = resolvedCat(it);
    return c ? CATS[c].icon : null;
  };

  const setItemCat = async (id, cat, icon) => {
    const next = {
      ...spending,
      [selKey]: selItems.map((it) => (it.id === id ? { ...it, cat, ...(icon !== undefined ? { icon } : {}) } : it)),
    };
    setSpending(next);
    await persist({ spending: next });
  };
  const setItemDescAndCat = async (id, desc, cat, icon) => {
    const next = {
      ...spending,
      [selKey]: selItems.map((it) => (it.id === id
        ? { ...it, cat, desc: desc !== undefined && desc !== "" ? desc : it.desc, ...(icon !== undefined ? { icon } : {}) }
        : it)),
    };
    setSpending(next);
    await persist({ spending: next });
  };

  // AI fallback when keywords don't match and the user picked nothing
  useEffect(() => {
    const pending = selItems.filter(
      (it) => !it.zero && !it.cat && !it.icon && it.desc && !inferCat(it.desc) && !aiCats[it.id] && !aiTried.current[it.id]
    );
    if (pending.length === 0 || !AI_OK) return;
    pending.forEach(async (it) => {
      aiTried.current[it.id] = true;
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1000,
            messages: [{
              role: "user",
              content: `Classify this expense description into exactly one category: food, transport, shopping, bills, other. Reply with ONLY the single lowercase word, nothing else.\n\nDescription: "${it.desc}"`,
            }],
          }),
        });
        const data = await res.json();
        const text = (data.content || []).map((c) => c.text || "").join("").trim().toLowerCase();
        const cat = CAT_ORDER.find((c) => text.includes(c));
        if (cat) setAiCats((m) => ({ ...m, [it.id]: cat }));
      } catch (e) { /* offline: stay uncategorised */ }
    });
  }, [selItems]);

  const closeCatMenu = () => {
    if (!catMenu) return;
    setCatMenu((m) => ({ ...m, closing: true }));
    setTimeout(() => setCatMenu(null), 180);
  };

  const commitEdits = async () => persist({});

  const saveLimit = async (val) => {
    const num = amtToIDR(val);
    const next = { ...limits, [mKey]: num || DEFAULT_LIMIT };
    if (!num) delete next[mKey];
    setLimits(next);
    await persist({ limits: next });
  };

  // triple-click "Daily limit" → copy this month's limit to every month of the year
  const [limitFlash, setLimitFlash] = useState(0);
  const applyLimitToYear = async () => {
    const next = { ...limits };
    for (let m = 0; m < 12; m++) {
      const k = monthKeyOf(year, m);
      if (dailyLimit === DEFAULT_LIMIT) delete next[k]; else next[k] = dailyLimit;
    }
    setLimits(next);
    setLimitFlash((n) => n + 1);
    await persist({ limits: next });
  };

  const pickCurrency = async (c) => {
    setCurrency(c);
    await persist({ currency: c });
  };

  const closePanel = () => {
    setPanelClosing(true);
    setPanelAnim(true);
    setTimeout(() => { setSelected(null); setPanelClosing(false); setPanelAnim(false); }, 340);
  };
  useEffect(() => {
    if (selected === null) return;
    setPanelAnim(true);
    const t = setTimeout(() => setPanelAnim(false), 360);
    return () => clearTimeout(t);
  }, [selected]);
  const closeChart = (after) => {
    setChartClosing(true); setHoverPt(null);
    setTimeout(() => {
      setChartOpen(false); setChartClosing(false);
      if (after) after();
    }, 190);
  };

  /* ---------- ghost .000 helper ---------- */
  const needsGhost = (val) => {
    const d = digitsOf(val);
    return !isMYR && d.length > 0 && d.length < 4;
  };

  const chart = useMemo(() => {
    const exp = [], inc = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const items = spending[keyOf(year, month, d)];
      const sp = items && items.length ? items.reduce((s, it) => s + it.amount, 0) : null;
      const ic = monthIncomes.filter((it) => it.day === d).reduce((s, it) => s + it.amount, 0) || null;
      exp.push(sp); inc.push(ic);
    }
    return { exp, inc };
  }, [spending, monthIncomes, year, month, daysInMonth]);

  /* ---------- weekly expense chart ---------- */
  const weekData = useMemo(() => {
    // Monday-first week containing today (or the 1st of the shown month)
    const base = selected !== null
      ? new Date(year, month, selected)
      : isCurrentMonth ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
                       : new Date(year, month, 1);
    const dow = (base.getDay() + 6) % 7;
    const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - dow);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const items = spending[keyOf(d.getFullYear(), d.getMonth(), d.getDate())] || [];
      const total = items.reduce((sum, it) => sum + it.amount, 0);
      const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      const isSel = selected !== null && d.getFullYear() === year && d.getMonth() === month && d.getDate() === selected;
      const future = d > now;
      days.push({ label: DOW_FULL[i], total, isToday, isSel, future, date: d });
    }
    let lastIdx = -1;
    days.forEach((d, i) => { if (!d.future || d.total > 0) lastIdx = i; });
    const first = days[0].date, last = days[6].date;
    const range = `${first.getDate()} ${MONTHS_SHORT[first.getMonth()]} – ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}`;
    return { days, lastIdx, range, total: days.reduce((s, d) => s + d.total, 0) };
  }, [spending, year, month, isCurrentMonth, selected, dayTick]);

  const renderWeek = () => {
    const pts = weekData.lastIdx >= 0 ? weekData.days.slice(0, weekData.lastIdx + 1) : [];
    const W = 720, H = 250, PL = 66, PR = 26, PT = 18, PB = 34;
    const iw = W - PL - PR, ih = H - PT - PB;
    const weekLimit = Math.max(...weekData.days.map((d) =>
      limits[monthKeyOf(d.date.getFullYear(), d.date.getMonth())] || DEFAULT_LIMIT));
    const maxV = Math.max(...weekData.days.map((d) => d.total), weekLimit, 1) * 1.15;
    const X = (i) => PL + (i / 6) * iw;
    const Y = (v) => PT + ih - (v / maxV) * ih;

    const curve = (arr) => {
      if (!arr.length) return "";
      let d = `M ${X(0)} ${Y(arr[0].total)}`;
      for (let k = 1; k < arr.length; k++) {
        const x0 = X(k - 1), y0 = Y(arr[k - 1].total);
        const x1 = X(k), y1 = Y(arr[k].total);
        const dx = (x1 - x0) / 2;
        d += ` C ${x0 + dx} ${y0}, ${x1 - dx} ${y1}, ${x1} ${y1}`;
      }
      return d;
    };
    const line = curve(pts);
    const area = pts.length > 1 ? `${line} L ${X(pts.length - 1)} ${PT + ih} L ${X(0)} ${PT + ih} Z` : "";
    const yTicks = [0, 0.33, 0.66, 1].map((f) => f * maxV);
    const endIdx = pts.length - 1;

    return (
      <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <linearGradient id="weekFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c7cdd2" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#c7cdd2" stopOpacity="0" />
          </linearGradient>
          {/* line colour by height: green under 75% of the limit, yellow up to the limit, red above it */}
          {(() => {
            const o = (y) => Math.min(1, Math.max(0, (y - PT) / ih));
            const yLim = o(Y(weekLimit)), yWarn = o(Y(weekLimit * WARN_FRAC));
            return (
              <linearGradient id="weekLine" gradientUnits="userSpaceOnUse" x1="0" y1={PT} x2="0" y2={PT + ih}>
                <stop offset={0} stopColor="#ff5d6c" />
                <stop offset={yLim} stopColor="#ff5d6c" />
                <stop offset={yLim} stopColor="#ffd069" />
                <stop offset={yWarn} stopColor="#ffd069" />
                <stop offset={yWarn} stopColor="#3ddc97" />
                <stop offset={1} stopColor="#3ddc97" />
              </linearGradient>
            );
          })()}
        </defs>
        {/* axes */}
        <line x1={PL} y1={PT - 4} x2={PL} y2={PT + ih} stroke="#4a5055" strokeWidth="1.4" />
        <line x1={PL} y1={PT + ih} x2={W - PR} y2={PT + ih} stroke="#4a5055" strokeWidth="1.4" />
        {yTicks.map((v, i) => (
          Math.abs(Y(v) - Y(weekLimit)) < 13 ? null : (
            <text key={i} x={PL - 12} y={Y(v) + 4} fill="#8a9299" fontSize="11" textAnchor="end">
              {v === 0 ? "0" : fmtCoarse(v)}
            </text>
          )
        ))}
        {weekData.days.map((d, i) => (
          <text key={i} x={X(i)} y={PT + ih + 22} fontSize="11" textAnchor="middle"
                fill={d.isSel || d.isToday ? "#e8eaec" : "#8a9299"} fontWeight={d.isSel || d.isToday ? 700 : 400}>
            {d.label}
          </text>
        ))}
        {/* daily limit marker */}
        {weekLimit > 0 && Y(weekLimit) > PT - 2 && (
          <g className="axis-fade" style={{ animationDelay: "260ms" }}>
            <line x1={PL} y1={Y(weekLimit)} x2={W - PR} y2={Y(weekLimit)}
                  stroke="#c7cdd2" strokeWidth="1.4" strokeDasharray="5 5" opacity="0.5" />
            <text x={PL - 12} y={Y(weekLimit) + 4} fill="#aeb5bb" fontSize="11"
                  fontWeight="600" textAnchor="end">
              {fmtCoarse(weekLimit)}
            </text>
          </g>
        )}

        {pts.length > 1 && (
          <>
            <path className="axis-fade" d={area} fill="url(#weekFill)" />
            <path className="line-draw" pathLength="1" d={line} fill="none" stroke="url(#weekLine)"
                  strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animationDuration: ".8s" }} />
          </>
        )}
        {pts.length > 0 && (() => {
          const todayInWeek = weekData.days.findIndex((d) => d.isToday);
          const mi = todayInWeek >= 0 && todayInWeek <= endIdx ? todayInWeek : endIdx;
          return (
            <circle className="axis-fade" style={{ animationDelay: "420ms" }}
                    cx={X(mi)} cy={Y(weekData.days[mi].total)} r="6"
                    fill="#1e2124" stroke="#e8eaec" strokeWidth="2.2" />
          );
        })()}

        {/* hover targets */}
        {weekData.days.map((d, i) => (
          <rect key={`h${i}`} x={X(i) - iw / 12} y={PT - 6} width={iw / 6} height={ih + 6}
                fill="transparent" style={{ cursor: d.future && d.total === 0 ? "default" : "pointer" }}
                onMouseEnter={() => (!d.future || d.total > 0) && setWeekHover({ i, x: X(i), y: Y(d.total), d })}
                onMouseLeave={() => setWeekHover(null)} />
        ))}
        {weekHover && (
          <g key={`wk-${weekHover.i}`} className="wk-tip" pointerEvents="none">
            <line x1={weekHover.x} y1={PT} x2={weekHover.x} y2={PT + ih} stroke="#3a3f44" strokeWidth="1" />
            <circle className="tip-dot" cx={weekHover.x} cy={weekHover.y} r="5" fill="#ffffff" />
          </g>
        )}
      </svg>
      {weekHover && (
        <GlassTip key={`wkg-${weekHover.i}`} W={W} H={H} x={Math.min(Math.max(weekHover.x, PL + 58), W - PR - 58)}
                  y={weekHover.y} below={weekHover.y < PT + 56} label={`${weekHover.d.label} ${weekHover.d.date.getDate()}`} value={fmt(weekHover.d.total)}
                  color={weekHover.d.total > weekLimit ? "#ff8d97" : weekHover.d.total > weekLimit * WARN_FRAC ? "#ffd98a" : "#9df0c9"} />
      )}
      </div>
    );
  };

  /* ---------- money flow (sankey) ---------- */
  const flowTotals = useMemo(() => {
    const t = { food: 0, transport: 0, shopping: 0, bills: 0, other: 0 };
    for (let d = 1; d <= daysInMonth; d++) {
      const items = spending[keyOf(year, month, d)] || [];
      items.forEach((it) => {
        const c = it.cat || inferCat(it.desc) || aiCats[it.id] || "other";
        t[c in t ? c : "other"] += it.amount;
      });
    }
    return t;
  }, [spending, year, month, daysInMonth, aiCats]);

  /* ---------- insights ---------- */
  const insights = useMemo(() => {
    const catOfItem = (it) => {
      const c = it.cat || inferCat(it.desc) || aiCats[it.id] || "other";
      return c in CATS ? c : "other";
    };
    const monthCats = (y, m) => {
      const t = { food: 0, transport: 0, shopping: 0, bills: 0, other: 0 };
      let total = 0, any = false;
      const dim = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= dim; d++) {
        (spending[keyOf(y, m, d)] || []).forEach((it) => { t[catOfItem(it)] += it.amount; total += it.amount; any = true; });
      }
      return { t, total, any };
    };
    const dayTot = (dt) => (spending[keyOf(dt.getFullYear(), dt.getMonth(), dt.getDate())] || []).reduce((a, it) => a + it.amount, 0);
    const B = ({ children }) => <b style={{ color: "#e8eaec", fontWeight: 700 }}>{children}</b>;
    const dLabel = (d) => `${d} ${MONTHS_SHORT[month]}`;
    const times = (r) => `${r >= 10 ? Math.round(r) : r.toFixed(1).replace(/\.0$/, "")}×`;

    const isCur = year === now.getFullYear() && month === now.getMonth();
    const isPast = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());
    const dim = new Date(year, month + 1, 0).getDate();
    // any month other than the current one is read as a whole month, including future months with (test) data
    const elapsed = isCur ? now.getDate() : dim;
    const cur = monthCats(year, month);
    if (!elapsed || !cur.any) return [];
    const out = [];

    // 1. category (and overall) vs the average of up to 3 previous months with data
    if (!isCur || elapsed >= 7) {
      const prev = [];
      for (let k = 1; k <= 12 && prev.length < 3; k++) {
        const dt = new Date(year, month - k, 1);
        const mc = monthCats(dt.getFullYear(), dt.getMonth());
        if (mc.any) prev.push(mc);
      }
      if (prev.length) {
        const factor = dim / elapsed;
        const n = prev.length;
        const cands = [];
        [...CAT_ORDER, "__all"].forEach((c) => {
          const avg = prev.reduce((a, mc) => a + (c === "__all" ? mc.total : mc.t[c]), 0) / n;
          const proj = (c === "__all" ? cur.total : cur.t[c]) * factor;
          if (avg < 20000 || proj < 1) return;
          const pct = Math.round(((proj - avg) / avg) * 100);
          if (Math.abs(pct) < 20) return;
          cands.push({ c, pct, avg });
        });
        cands.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 2).forEach(({ c, pct, avg }) => {
          const up = pct > 0;
          const name = c === "__all" ? "Total" : CATS[c].label;
          out.push({
            key: `cat-${c}`, tone: up ? "bad" : "good", icon: up ? "trending_up" : "trending_down",
            text: <>{name} spending {isCur ? "is on pace to be" : "was"} <B>{Math.abs(pct)}% {up ? "higher" : "lower"}</B> than your {n}-month average ({fmt(avg)}).</>,
          });
        });
      }
    }

    // 2. monthly budget (daily limit × days)
    const lim = limits[monthKeyOf(year, month)] || DEFAULT_LIMIT;
    const budget = lim * dim;
    let cum = 0, crossed = 0;
    for (let d = 1; d <= elapsed; d++) {
      cum += dayTot(new Date(year, month, d));
      if (!crossed && cum > budget) crossed = d;
    }
    if (crossed) {
      out.push({ key: "budget", tone: "bad", icon: "event_busy",
        text: <>You passed this month's budget of {fmt(budget)} on <B>{dLabel(crossed)}</B>.</> });
    } else if (isCur && elapsed >= 3) {
      const rate = cur.total / elapsed;
      const day = rate > 0 ? Math.ceil(budget / rate) : Infinity;
      if (day <= dim) {
        out.push({ key: "budget", tone: "bad", icon: "event_busy",
          text: <>At your current pace ({fmt(rate)}/day) you'll pass your {fmt(budget)} budget around <B>{dLabel(day)}</B>.</> });
      } else {
        out.push({ key: "budget", tone: "good", icon: "event_available",
          text: <>At this pace you'll finish the month about <B>{fmt(budget - rate * dim)} under</B> your {fmt(budget)} budget.</> });
      }
    } else if (!isCur) {
      out.push({ key: "budget", tone: "good", icon: "event_available",
        text: <>You finished {MONTHS_SHORT[month]} <B>{fmt(budget - cur.total)} under</B> your {fmt(budget)} budget.</> });
    }

    // 3. income pace
    const inc = (incomes[monthKeyOf(year, month)] || []).reduce((a, it) => a + it.amount, 0);
    if (isCur && inc > 0 && elapsed >= 3) {
      const rate = cur.total / elapsed;
      if (cur.total > inc) {
        out.push({ key: "income", tone: "bad", icon: "account_balance_wallet",
          text: <>Spending has already passed this month's income by <B>{fmt(cur.total - inc)}</B>.</> });
      } else if (rate > 0 && Math.ceil(inc / rate) <= dim) {
        out.push({ key: "income", tone: "bad", icon: "account_balance_wallet",
          text: <>At this pace, spending will overtake this month's income around <B>{dLabel(Math.ceil(inc / rate))}</B>.</> });
      }
    }

    // 4. weekend vs weekday pattern over the last 8 weeks
    {
      const end = isCur ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(year, month, dim);
      let we = 0, weN = 0, weHits = 0, wd = 0, wdN = 0, wdHits = 0;
      for (let k = 0; k < 56; k++) {
        const dt = new Date(end.getFullYear(), end.getMonth(), end.getDate() - k);
        const v = dayTot(dt);
        const isWe = dt.getDay() === 0 || dt.getDay() === 6;
        if (isWe) { we += v; weN++; if (v > 0) weHits++; } else { wd += v; wdN++; if (v > 0) wdHits++; }
      }
      const weAvg = we / weN, wdAvg = wd / wdN;
      if (weHits >= 2 && wdHits >= 3 && wdAvg > 0) {
        const r = weAvg / wdAvg;
        if (r >= 1.5) {
          out.push({ key: "weekend", tone: "warn", icon: "weekend",
            text: <>You usually spend <B>{times(r)} more</B> per day on weekends ({fmt(weAvg)} vs {fmt(wdAvg)} on weekdays).</> });
        } else if (r <= 0.67) {
          out.push({ key: "weekend", tone: "good", icon: "weekend",
            text: <>Weekends are your lighter days: <B>{fmt(weAvg)}/day</B> vs {fmt(wdAvg)} on weekdays.</> });
        }
      }
    }

    // 5. under-limit streak (logged days, most recent first)
    if (isCur) {
      let streak = 0;
      for (let d = elapsed; d >= 1; d--) {
        const items = spending[keyOf(year, month, d)] || [];
        if (!items.length) continue;
        if (items.reduce((a, it) => a + it.amount, 0) > lim) break;
        streak++;
      }
      if (streak >= 3) {
        out.push({ key: "streak", tone: "good", icon: "local_fire_department",
          text: <>Your last <B>{streak} logged days</B> were all under the daily limit.</> });
      }
    }

    // 6. most frequent place this month
    {
      const map = {};
      for (let d = 1; d <= dim; d++) {
        (spending[keyOf(year, month, d)] || []).forEach((it) => {
          const raw = (it.desc || "").trim();
          if (!raw || it.zero) return;
          const k = canonKey(raw);
          if (!map[k]) map[k] = { n: 0, sum: 0 };
          map[k].n++; map[k].sum += it.amount;
        });
      }
      const top = Object.entries(map).sort((a, b) => b[1].n - a[1].n || b[1].sum - a[1].sum)[0];
      if (top && top[1].n >= 3) {
        out.push({ key: "freq", tone: "neutral", icon: "storefront",
          text: <><B>{prettyName(top[0])}</B> shows up {top[1].n} times this month, {fmt(top[1].sum)} in total.</> });
      }
    }

    // ---- per-day totals for the elapsed part of this month (used by several insights below)
    const days = [];
    for (let d = 1; d <= elapsed; d++) {
      const items = spending[keyOf(year, month, d)] || [];
      days.push({ d, items, total: items.reduce((a, it) => a + it.amount, 0), zero: items.some((it) => it.zero) });
    }
    const logged = days.filter((x) => x.items.length);

    // 7. same point last month
    {
      const pd = new Date(year, month - 1, 1), pdim = new Date(pd.getFullYear(), pd.getMonth() + 1, 0).getDate();
      let prevSoFar = 0;
      for (let d = 1; d <= Math.min(elapsed, pdim); d++) prevSoFar += dayTot(new Date(pd.getFullYear(), pd.getMonth(), d));
      const curSoFar = days.reduce((a, x) => a + x.total, 0);
      if (prevSoFar > 0) {
        const pct = Math.round(((curSoFar - prevSoFar) / prevSoFar) * 100);
        if (Math.abs(pct) >= 10) {
          const up = pct > 0;
          out.push({ key: "mom", tone: up ? "warn" : "good", icon: up ? "arrow_upward" : "arrow_downward",
            text: <>{isCur ? `By day ${elapsed}` : "This month"} you've spent <B>{fmt(Math.abs(curSoFar - prevSoFar))} {up ? "more" : "less"}</B> than {MONTHS_FULL[pd.getMonth()]} ({up ? "+" : "−"}{Math.abs(pct)}%).</> });
        }
      }
    }

    // 8. days over the daily limit
    {
      const over = logged.filter((x) => x.total > lim);
      if (over.length) {
        const worst = over.reduce((a, b) => (b.total > a.total ? b : a));
        out.push({ key: "over", tone: over.length >= logged.length / 2 ? "bad" : "warn", icon: "report",
          text: <><B>{over.length} day{over.length === 1 ? "" : "s"}</B> over your daily limit so far; the biggest was {dLabel(worst.d)} at {fmt(worst.total)}.</> });
      }
    }

    // 9. no-spend days
    {
      const z = days.filter((x) => x.zero && x.total === 0).length;
      if (z > 0) out.push({ key: "zero", tone: "good", icon: "do_not_disturb_on",
        text: <><B>{z} no-spend day{z === 1 ? "" : "s"}</B> this month, keeping {fmt(z * lim)} of your limit untouched.</> });
    }

    // 10. small purchases add up
    {
      const SMALL = 25000;
      const small = logged.flatMap((x) => x.items).filter((it) => !it.zero && it.amount < SMALL);
      const sum = small.reduce((a, it) => a + it.amount, 0);
      if (small.length >= 8 && cur.total > 0) out.push({ key: "small", tone: "neutral", icon: "local_cafe",
        text: <>{small.length} small buys under {fmt(SMALL)} added up to <B>{fmt(sum)}</B>, {Math.round((sum / cur.total) * 100)}% of this month's spending.</> });
    }

    // 11. priciest weekday over the last 8 weeks
    {
      const end = isCur ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(year, month, dim);
      const sum = Array(7).fill(0), cnt = Array(7).fill(0);
      for (let k = 0; k < 56; k++) {
        const dt = new Date(end.getFullYear(), end.getMonth(), end.getDate() - k);
        const i = (dt.getDay() + 6) % 7; sum[i] += dayTot(dt); cnt[i]++;
      }
      const avg = sum.map((v, i) => v / (cnt[i] || 1)), overall = sum.reduce((a, b) => a + b, 0) / 56;
      let top = 0; for (let i = 1; i < 5; i++) if (avg[i] > avg[top]) top = i;   // Mon–Fri only; weekends have their own insight
      if (overall > 0 && avg[top] / overall >= 1.3) out.push({ key: "dow", tone: "neutral", icon: "calendar_month",
        text: <><B>{["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays"][top]}</B> are your priciest weekday, averaging {fmt(avg[top])} ({times(avg[top] / overall)} your usual day).</> });
    }

    // 12. biggest single purchase
    {
      let big = null;
      logged.forEach((x) => x.items.forEach((it) => { if (!it.zero && (!big || it.amount > big.amount)) big = { ...it, d: x.d }; }));
      if (big && big.amount >= lim) out.push({ key: "big", tone: "neutral", icon: "shopping_bag",
        text: <>Biggest purchase: <B>{big.desc ? prettyName(canonKey(big.desc)) : "an unlabelled expense"}</B>, {fmt(big.amount)} on {dLabel(big.d)}.</> });
    }

    // 13. average daily spend vs the limit
    if (logged.length >= 3) {
      const avg = logged.reduce((a, x) => a + x.total, 0) / logged.length;
      const pct = Math.round((avg / lim) * 100);
      out.push({ key: "avg", tone: pct > 100 ? "warn" : "good", icon: "speed",
        text: <>You average <B>{fmt(avg)} a day</B>, {pct}% of your {fmt(lim)} limit.</> });
    }

    // 14. category share of the month
    {
      const top = CAT_ORDER.map((c) => [c, cur.t[c]]).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] > 0 && cur.total > 0) {
        const share = Math.round((top[1] / cur.total) * 100);
        if (share >= 35) out.push({ key: "share", tone: "neutral", icon: CATS[top[0]].icon,
          text: <><B>{CATS[top[0]].label}</B> makes up {share}% of this month's spending ({fmt(top[1])}).</> });
      }
    }

    // 15. goal forecasts: when each active goal will be reached at its usual monthly pace
    {
      const c0 = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const cutoff = keyOf(c0.getFullYear(), c0.getMonth(), 1);
      const eta = [];
      goals.forEach((g) => {
        const saved = Math.max(0, (g.deposits || []).reduce((a, d) => a + d.amount, 0));
        if (!g.target || saved >= g.target) return;
        const byMonth = {};
        (g.deposits || []).forEach((d) => { if (d.date >= cutoff) byMonth[d.date.slice(0, 7)] = (byMonth[d.date.slice(0, 7)] || 0) + d.amount; });
        const months = Object.values(byMonth);
        if (months.length < 2) return;
        const pace = months.reduce((a, b) => a + b, 0) / 6;       // average over the last 6 months, gaps included
        if (pace <= 0) return;
        const n = Math.ceil((g.target - saved) / pace);
        const when = new Date(now.getFullYear(), now.getMonth() + n, 1);
        eta.push({ g, n, when });
      });
      eta.sort((a, b) => a.n - b.n).slice(0, 2).forEach(({ g, n, when }) => out.push({ key: `eta-${g.id}`, tone: n <= 12 ? "good" : "neutral", icon: "flag",
        text: <>At your usual pace, <B>{g.name}</B> will be fully funded around <B>{MONTHS_FULL[when.getMonth()]} {when.getFullYear()}</B>{n > 24 ? `, about ${Math.round(n / 12)} years away` : ""}.</> }));
    }

    const order = { bad: 0, warn: 1, good: 2, neutral: 3 };
    return out.sort((a, b) => order[a.tone] - order[b.tone]);
  }, [spending, incomes, limits, aiCats, year, month, currency, goals, dayTick]);

  const catBreakdown = useMemo(() => {
    if (!catView) return { rows: [], total: 0 };
    const map = {};
    if (catView === "income") {
      monthIncomes.forEach((it) => {
        const raw = (it.desc || "").trim();
        const key = canonKey(raw);
        if (!map[key]) map[key] = { label: prettyName(key === "__none__" ? "" : key), amount: 0 };
        map[key].amount += it.amount;
      });
    } else {
      for (let d = 1; d <= daysInMonth; d++) {
        const items = spending[keyOf(year, month, d)] || [];
        items.forEach((it) => {
          const c = it.cat || inferCat(it.desc) || aiCats[it.id] || "other";
          if (it.zero || (c in CATS ? c : "other") !== catView) return;
          const raw = (it.desc || "").trim();
          const key = canonKey(raw);
          if (!map[key]) map[key] = { label: prettyName(key === "__none__" ? "" : key), amount: 0 };
          map[key].amount += it.amount;
        });
      }
    }
    const rows = Object.values(map).sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    // same category, previous month
    const pd = new Date(year, month - 1, 1), py = pd.getFullYear(), pm = pd.getMonth();
    let prevTotal = 0;
    if (catView === "income") {
      prevTotal = (incomes[monthKeyOf(py, pm)] || []).reduce((s, it) => s + it.amount, 0);
    } else {
      const pdim = new Date(py, pm + 1, 0).getDate();
      for (let d = 1; d <= pdim; d++) {
        (spending[keyOf(py, pm, d)] || []).forEach((it) => {
          const c = it.cat || inferCat(it.desc) || aiCats[it.id] || "other";
          if ((c in CATS ? c : "other") === catView) prevTotal += it.amount;
        });
      }
    }
    const vsPct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
    return { rows, total, vsPct };
  }, [catView, spending, incomes, year, month, daysInMonth, aiCats]);

  const closeCatView = () => {
    setCatViewClosing(true);
    setTimeout(() => { setCatView(null); setCatViewClosing(false); }, 190);
  };

  // measure the list so the modal can animate its height between categories
  const bdRef = useRef(null);
  const [bdHeight, setBdHeight] = useState("auto");
  useLayoutEffect(() => {
    if (!catView || !bdRef.current) return;
    const h = bdRef.current.getBoundingClientRect().height;
    setBdHeight(`${h}px`);
  }, [catView, catBreakdown]);

  const renderFlow = () => {
    const nodes = CAT_ORDER.filter((c) => flowTotals[c] > 0).map((c) => ({
      key: c, label: CATS[c].label, icon: CATS[c].icon, value: flowTotals[c], color: CAT_COLORS[c],
    }));
    const leftOver = totalIncome - stats.spent;
    if (leftOver > 0 && totalIncome > 0) {
      nodes.push({ key: "left", label: "Left over", icon: "savings", value: leftOver, color: CAT_COLORS.left });
    }
    if (nodes.length === 0) {
      return <div style={S.flowEmpty}>No expenses recorded yet this month.</div>;
    }

    const total = nodes.reduce((s, n) => s + n.value, 0);
    const GAP = 14, PT = 18, PB = 18;
    const H = PT + PB + nodes.length * 44 + (nodes.length - 1) * 4;
    const W = 720, xL = 92, barW = 11, xR = 470;
    const inner = H - PT - PB - GAP * (nodes.length - 1);
    let yR = PT, yL = PT;
    const rows = nodes.map((n) => {
      const h = Math.max(6, (n.value / total) * inner);
      const r = { ...n, hR: h, yR, yL, hL: h };
      yR += h + GAP;
      yL += h;
      return r;
    });
    const leftH = yL - PT;

    const ribbon = (y0, y1, y2, y3) => {
      const mx = (xL + barW + xR) / 2;
      const x1 = xL + barW;
      return `M ${x1} ${y0} C ${mx} ${y0}, ${mx} ${y2}, ${xR} ${y2} L ${xR} ${y3} C ${mx} ${y3}, ${mx} ${y1}, ${x1} ${y1} Z`;
    };

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <clipPath id="flowWipe">
            <rect className="flow-wipe-rect" x="0" y="0" width={W} height={H} />
          </clipPath>
          {rows.map((r) => (
            <linearGradient key={r.key} id={`fg-${r.key}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={r.color} stopOpacity="0.30" />
              <stop offset="100%" stopColor={r.color} stopOpacity="0.72" />
            </linearGradient>
          ))}
        </defs>

        {/* source bar */}
        <rect className="flow-src" x={xL} y={PT} width={barW} height={leftH} rx={5} fill="#8a9299" opacity="0.75" />
        <foreignObject x={xL - 190} y={PT + leftH / 2 - 20} width="182" height="42">
          <div xmlns="http://www.w3.org/1999/xhtml"
               className={totalIncome > 0 ? "flow-label" : ""}
               onClick={totalIncome > 0 ? () => setCatView("income") : undefined}
               style={{ fontFamily: "Inter, sans-serif", textAlign: "right", padding: "4px 7px", borderRadius: 7,
                        cursor: totalIncome > 0 ? "pointer" : "default" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaec" }}>{totalIncome > 0 ? "Income" : "Spent"}</div>
            <div style={{ fontSize: 12, color: "#8a9299", fontVariantNumeric: "tabular-nums" }}>
              {fmt(totalIncome > 0 ? totalIncome : stats.spent)}
            </div>
          </div>
        </foreignObject>

        {/* ribbons sweep in from the left */}
        <g clipPath="url(#flowWipe)">
          {rows.map((r) => (
            <path key={r.key} d={ribbon(r.yL, r.yL + r.hL, r.yR, r.yR + r.hR)} fill={`url(#fg-${r.key})`} />
          ))}
        </g>

        {/* target bars + labels arrive as the sweep reaches them */}
        {rows.map((r, i) => (
          <g key={r.key} className="flow-node" style={{ animationDelay: `${430 + i * 55}ms` }}>
            <rect x={xR} y={r.yR} width={barW} height={r.hR} rx={5} fill={r.color} />
            <foreignObject x={xR + 18} y={r.yR + r.hR / 2 - 14} width="260" height="30">
              <div xmlns="http://www.w3.org/1999/xhtml"
                   className={r.key === "left" ? "" : "flow-label"}
                   onClick={r.key === "left" ? undefined : () => setCatView(r.key)}
                   style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "Inter, sans-serif",
                            padding: "3px 7px", borderRadius: 7, cursor: r.key === "left" ? "default" : "pointer" }}>
                <span className="msym" style={{ fontSize: 18, color: r.color }}>{r.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e8eaec" }}>{r.label}</span>
                <span style={{ fontSize: 12, color: "#8a9299", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(r.value)} · {Math.round((r.value / total) * 100)}%
                </span>
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>
    );
  };

  /* ---------- money efficiency score ---------- */
  const scoreFor = (y, m) => {
    const dim = new Date(y, m + 1, 0).getDate();
    const lim = limits[monthKeyOf(y, m)] || DEFAULT_LIMIT;
    let spent = 0, green = 0, red = 0;
    const days = [];
    for (let d = 1; d <= dim; d++) {
      const items = spending[keyOf(y, m, d)];
      if (!items || items.length === 0) continue;
      const sp = items.reduce((s, it) => s + it.amount, 0);
      spent += sp; days.push(sp);
      if (sp <= lim) green++; else red++;
    }
    if (days.length === 0) return null;
    const inc = (incomes[monthKeyOf(y, m)] || []).reduce((s, it) => s + it.amount, 0);
    const savings = inc > 0 ? Math.max(0, Math.min(1, (inc - spent) / inc)) : 0;
    const disc = green / (green + red);
    const mean = spent / days.length;
    const sd = Math.sqrt(days.reduce((s, v) => s + (v - mean) ** 2, 0) / days.length);
    const cv = mean > 0 ? Math.min(1, sd / mean) : 1;
    const discPts = disc * 35;
    const savingsPts = inc > 0 ? (Math.min(savings, 0.5) / 0.5) * 40 : (disc * 40);
    const consPts = (1 - cv) * 25;
    return {
      score: Math.round(savingsPts + discPts + consPts),
      savings, disc, cv, spent, inc, green, red, days: days.length, lim,
    };
  };
  const scoreNow = useMemo(() => scoreFor(year, month), [spending, incomes, limits, year, month]);
  // Savings-rate bands (soft palette, red → green)
  const scoreBand = (pct) =>
    pct <= 15 ? { word: "Awful", color: "#e2808c" } :
    pct <= 35 ? { word: "Moderate", color: "#e9a173" } :
    pct <= 50 ? { word: "Balanced", color: "#e3cd77" } :
    pct <= 60 ? { word: "Good", color: "#b6d886" } :
    pct <= 75 ? { word: "Great", color: "#8fd7a4" } :
    pct <= 90 ? { word: "Excellent", color: "#74cf9b" } :
                { word: "Exceptional", color: "#e6c877", star: true };

  // Trend badge: this month's savings rate vs the average of the last 3 months with data
  const savingsTrend = useMemo(() => {
    const hist = [];
    for (let k = 1; k <= 6 && hist.length < 3; k++) {
      let m = month - k, y = year;
      while (m < 0) { m += 12; y -= 1; }
      const st = scoreFor(y, m);
      if (st && st.inc > 0) hist.push(st.savings * 100);
    }
    if (hist.length === 0) return null;
    return hist.reduce((a, b) => a + b, 0) / hist.length;
  }, [spending, incomes, limits, year, month]);

  // Previous month's leftover (income - spent) in Rp, for the vs-last-month box
  const prevMonthSaved = useMemo(() => {
    let m = month - 1, y = year;
    if (m < 0) { m = 11; y -= 1; }
    const st = scoreFor(y, m);
    if (!st || (st.inc === 0 && st.spent === 0)) return null;
    return st.inc - st.spent;
  }, [spending, incomes, limits, year, month]);

  const trendOf = (pct) => {
    if (savingsTrend === null) return { text: "NEW", color: "#8a9299", delta: null };
    const diff = pct - savingsTrend;
    if (diff >= 3) return { text: "IMPROVING", color: "#8fd7a4", delta: diff };
    if (diff <= -3) return { text: "DECLINING", color: "#e2808c", delta: diff };
    return { text: "STABLE", color: "#b6d886", delta: diff };
  };

  const consistencyOf = (cv) =>
    cv > 0.8 ? { word: "ERRATIC", color: "#e2808c" } :
    cv > 0.6 ? { word: "INCONSISTENT", color: "#e9a173" } :
    cv > 0.4 ? { word: "VARIABLE", color: "#e3cd77" } :
    cv > 0.22 ? { word: "CONSISTENT", color: "#b6d886" } :
                { word: "STEADY", color: "#8fd7a4" };

  const renderScore = () => {
    if (!scoreNow) return null;
    const hasInc = scoreNow.inc > 0;
    const savePct = hasInc ? Math.max(0, Math.round(scoreNow.savings * 100)) : 0;
    const band = hasInc ? scoreBand(savePct) : { word: "No income", color: "#8a9299" };
    const cond = hasInc ? trendOf(savePct) : { text: "NO INCOME", color: "#8a9299", delta: null };
    const cons = consistencyOf(scoreNow.cv);

    const R = 52, C = 2 * Math.PI * R, ARC = C * (300 / 360);
    const filled = ARC * (Math.max(0, Math.min(100, savePct)) / 100);

    const summary = hasInc
      ? `You kept ${savePct}% of this month's income, stayed under the ${fmt(scoreNow.lim)} limit on ${scoreNow.green} of ${scoreNow.days} logged days, and day-to-day spending looks ${cons.word.toLowerCase()}.`
      : `No income logged this month yet. You stayed under the ${fmt(scoreNow.lim)} limit on ${scoreNow.green} of ${scoreNow.days} logged days, and day-to-day spending looks ${cons.word.toLowerCase()}.`;

    const discPct = Math.round(scoreNow.disc * 100);
    const discColor = "#e3cd77";
    const consPct = Math.round((1 - Math.min(1, scoreNow.cv)) * 100);
    const boxes = [
      (() => {
        const thisSaved = scoreNow.inc - scoreNow.spent;
        if (prevMonthSaved === null) {
          return { label: "VS LAST MONTH", value: "N/A", pct: 0, color: "#8a9299" };
        }
        const diff = thisSaved - prevMonthSaved;
        const base = Math.max(Math.abs(prevMonthSaved), Math.abs(thisSaved), 1);
        const relPct = prevMonthSaved !== 0 ? Math.round((diff / Math.abs(prevMonthSaved)) * 100) : null;
        return {
          label: "VS LAST MONTH",
          value: `${diff >= 0 ? "+" : "-"}${fmt(Math.abs(diff))}`,
          note: relPct !== null ? `${relPct >= 0 ? "+" : ""}${relPct}%` : null,
          pct: Math.round((Math.abs(diff) / base) * 100),
          color: diff >= 0 ? "#8fd7a4" : "#e2808c",
        };
      })(),
      { label: "LIMIT DISCIPLINE", value: `${scoreNow.green}/${scoreNow.days}`, pct: discPct, color: discColor },
      { label: "CONSISTENCY", value: cons.word, pct: consPct, color: cons.color },
    ];

    return (
      <div className="score-card" style={S.scoreCard}>
        <div key={`gauge-${year}-${month}-${savePct}`} style={{ position: "relative", width: 132, height: 132, flexShrink: 0 }}>
          <svg viewBox="0 0 132 132" style={{ width: 132, height: 132, transform: "rotate(120deg)" }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#e2808c" />
                <stop offset="45%" stopColor={savePct > 35 ? "#e3cd77" : "#e9a173"} />
                <stop offset="100%" stopColor={band.color} />
              </linearGradient>
            </defs>
            <circle cx="66" cy="66" r={R} fill="none" stroke="#33373b" strokeWidth="11" strokeLinecap="round"
                    strokeDasharray={`${ARC} ${C}`} />
            <circle className="score-arc" cx="66" cy="66" r={R} fill="none" stroke="url(#scoreGrad)" strokeWidth="11"
                    strokeLinecap="round" strokeDasharray={`${filled} ${C}`} />
          </svg>
          <div style={S.scoreCenter}>
            <div style={S.scoreNum}>{hasInc ? `${savePct}` : "—"}</div>
            <div style={S.scoreCap}>SCORE</div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ ...S.scoreWord, color: band.color }}>
              {band.star ? "★ " : ""}{band.word}
            </span>
            <span title={cond.delta !== null && cond.delta !== undefined
                          ? `${cond.delta >= 0 ? "+" : ""}${cond.delta.toFixed(1)} pts vs recent months`
                          : "No earlier months to compare"}
                  style={{ ...S.scorePill, color: cond.color, background: "rgba(255,255,255,0.05)", border: `1px solid ${cond.color}44` }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: cond.color, display: "inline-block", marginRight: 7 }} />
              {cond.text}
            </span>
          </div>
          <div style={S.scoreLabel}>MONEY EFFICIENCY</div>
          <p style={S.scoreText}>{summary}</p>
        </div>

        <div style={S.subRow}>
          {boxes.map((b, bi) => (
            <div key={b.label} className="sub-box glass-soft" style={{ ...S.subBox, animationDelay: `${260 + bi * 90}ms` }}>
              <div style={S.subLabel}>{b.label}</div>
              <div style={{ ...S.subValue, color: b.color, fontSize: b.label === "CONSISTENCY" || b.label === "VS LAST MONTH" ? 18 : 22, display: "flex", alignItems: "baseline", gap: 7 }}>
                {b.value}
                {b.note && <span style={S.subNote}>{b.note}</span>}
              </div>
              <div style={S.subTrack}>
                <span className="bd-fill" style={{ width: `${Math.max(2, Math.min(100, b.pct))}%`, background: b.color, animationDelay: `${340 + bi * 90}ms` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Esc closes whichever pop-up is on top
  useEffect(() => {
    if (!cfgDraft && !catView && !chartOpen) return;
    const onKey = (e) => {
      if (e.key !== "Escape" || recap) return;
      if (cfgDraft) closeTestCfg();
      else if (catView) closeCatView();
      else if (chartOpen) closeChart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cfgDraft, catView, chartOpen, recap]);

  /* ---------- test-data settings pop-up ---------- */
  const renderTestCfg = () => {
    const d = cfgDraft;
    if (!d) return null;
    const set = (patch) => setCfgDraft((x) => ({ ...x, ...patch }));
    const a = cfgNum(d.incMinStr), b = cfgNum(d.incMaxStr), ok = cfgValid(d);
    const perMonth = d.incFreq === "1" ? [1, 1] : d.incFreq === "2-3" ? [2, 3] : d.incFreq === "weekly" ? [4, 4] : [1, 2];
    const est = estimateStyle(SPEND_STYLES[d.style]);
    const step = (key, dir) => { const v = cfgNum(d[key]) ?? 0; set({ [key]: String(Math.max(0.5, Math.round((v + dir * 0.5) * 2) / 2)) }); };
    const seg = (value, options, onPick) => (
      <span className="tcfg-seg">
        {options.map(([v, lbl]) => <button key={v} className={value === v ? "on" : ""} onClick={() => onPick(v)}>{lbl}</button>)}
      </span>
    );
    const numBox = (k) => (
      <span className={`tcfg-num${cfgNum(d[k]) === null ? " bad" : ""}`}>
        <button onClick={() => step(k, -1)} aria-label="Less">−</button>
        <input value={d[k]} inputMode="decimal" onChange={(e) => set({ [k]: e.target.value.replace(/[^\d.,]/g, "") })}
               onKeyDown={(e) => { if (e.key === "Enter") runTestCfg(); }} />
        <span className="tcfg-unit">jt</span>
        <button onClick={() => step(k, 1)} aria-label="More">+</button>
      </span>
    );
    return (
      <div style={{ ...S.backdrop, zIndex: 70, animation: cfgClosing ? "fadeOut .22s ease both" : "fadeIn .22s ease backwards" }} onClick={closeTestCfg}>
        <div className="glass tcfg-modal" onClick={(e) => e.stopPropagation()}
             style={{ animation: cfgClosing ? "modalPopOut .23s var(--ease-soft) both" : "modalPop .42s var(--ease) backwards" }}>
          <div style={S.modalHead}>
            <span style={S.wrKicker}><span className="msym" style={{ fontSize: 17, color: "#e3cd77" }}>science</span>Test data settings</span>
            <button style={S.closeBtn} onClick={closeTestCfg}>✕</button>
          </div>
          <div className="tcfg-sub">Generated entries are added to {d.range === "month" ? `${MONTHS_FULL[month]} ${year}` : d.range === "rest" ? `${MONTHS_SHORT[month]}–Dec ${year}` : `all of ${year}`}. Clear test data removes only these.</div>

          <div className="tcfg-sec">
            <div className="tcfg-h"><span className="msym">payments</span>Income</div>
            <div className="tcfg-row"><span className="tcfg-lbl">Amount per payment</span>
              <span className="tcfg-ctl">{numBox("incMinStr")}<span className="tcfg-to">to</span>{numBox("incMaxStr")}</span></div>
            {a !== null && b !== null && b < a && <div className="tcfg-err">The maximum must be at least the minimum.</div>}
            <div className="tcfg-row"><span className="tcfg-lbl">How often</span>
              {seg(d.incFreq, [["1", "Once"], ["1-2", "1–2×"], ["2-3", "2–3×"], ["weekly", "Weekly"]], (v) => set({ incFreq: v }))}</div>
            <div className="tcfg-row"><span className="tcfg-lbl">When it arrives</span>
              <span style={{ opacity: d.incFreq === "weekly" ? 0.4 : 1, pointerEvents: d.incFreq === "weekly" ? "none" : "auto" }}>
                {seg(d.incTiming, [["start", "Start of month"], ["spread", "Spread out"]], (v) => set({ incTiming: v }))}</span></div>
          </div>

          <div className="tcfg-sec">
            <div className="tcfg-h"><span className="msym">shopping_cart</span>Spending style</div>
            <div className="tcfg-styles">
              {Object.entries(SPEND_STYLES).map(([k, st]) => (
                <button key={k} className={`tcfg-style${d.style === k ? " on" : ""}`} onClick={() => set({ style: k })}>
                  <span className="msym tcfg-style-ico">{st.icon}</span>
                  <span className="tcfg-style-name">{st.label}</span>
                  <span className="tcfg-style-desc">{st.desc}</span>
                  <span className="tcfg-style-est">≈ {fmt(estimateStyle(st))}/mo</span>
                </button>
              ))}
            </div>
          </div>

          <div className="tcfg-sec">
            <div className="tcfg-h"><span className="msym">date_range</span>Range</div>
            <div className="tcfg-row"><span className="tcfg-lbl">Months</span>
              {seg(d.range, [["year", `All of ${year}`], ["month", `${MONTHS_SHORT[month]} only`], ["rest", `${MONTHS_SHORT[month]}–Dec`]], (v) => set({ range: v }))}</div>
            <div className="tcfg-row"><span className="tcfg-lbl">Sample goals</span>
              <button className={`tcfg-switch${d.goals ? " on" : ""}`} onClick={() => set({ goals: !d.goals })} aria-pressed={d.goals}><span /></button></div>
          </div>

          <div className="tcfg-foot">
            <span className="tcfg-est">
              {ok ? <>≈ <b style={{ color: "#8fd7a4" }}>{fmt(a * 1e6 * perMonth[0])}{perMonth[1] !== perMonth[0] || a !== b ? `–${fmt(b * 1e6 * perMonth[1])}` : ""}</b> in, ≈ <b style={{ color: "#ff8d97" }}>{fmt(est)}</b> out per month</> : "Enter an income range to continue"}
            </span>
            <span style={{ display: "inline-flex", gap: 8 }}>
              <button className="bk-btn" onClick={() => setCfgDraft({ ...DEFAULT_TEST_CFG, incMinStr: String(DEFAULT_TEST_CFG.incMin), incMaxStr: String(DEFAULT_TEST_CFG.incMax) })}>Reset</button>
              <button className="tcfg-go" disabled={!ok} onClick={runTestCfg}><span className="msym" style={{ fontSize: 18 }}>auto_awesome</span>Generate</button>
            </span>
          </div>
        </div>
      </div>
    );
  };

  /* ---------- recap modal ---------- */
  const renderRecapDetail = (r, signed) => {
    const isYear = r.kind === "year";
    const unitWord = isYear ? "months" : "days";
    const key = recapDetail || "";
    let title = "", icon = "list", acc = "#9aa3ab", body = null, controls = null;

    if (key.startsWith("cat")) {
      const big = key.startsWith("catbig:");
      const c = key.split(":")[1];
      acc = CAT_COLORS[c]; icon = CATS[c].icon;
      title = big ? `Biggest ${CATS[c].label.toLowerCase()} purchases` : `Top ${CATS[c].label.toLowerCase()} spending`;
      controls = (
        <div className="wr-chips">
          {r.catRows.map((cr) => (
            <button key={cr.c} className={`wr-chip${cr.c === c ? " on" : ""}`} style={{ "--acc": CAT_COLORS[cr.c] }}
                    onClick={() => setRecapDetail(`${big ? "catbig" : "cat"}:${cr.c}`)}>
              <span className="msym" style={{ fontSize: 15 }}>{CATS[cr.c].icon}</span>{CATS[cr.c].label}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <span className="wr-seg">
            <button className={!big ? "on" : ""} onClick={() => setRecapDetail(`cat:${c}`)}>By item</button>
            <button className={big ? "on" : ""} onClick={() => setRecapDetail(`catbig:${c}`)}>Single purchases</button>
          </span>
        </div>
      );
      if (big) {
        const rows = r.txs.filter((t) => t.cat === c).sort((a, b) => b.amount - a.amount).slice(0, 10);
        const max = rows[0]?.amount || 1;
        body = <WrList dkey={key} color={acc} emptyText="Nothing in this category." rows={rows.map((t) => ({ label: t.name, value: fmt(t.amount), sub: t.when, frac: t.amount / max }))} />;
      } else {
        const rows = (r.catItemLists[c] || []).slice(0, 10);
        const max = rows[0]?.sum || 1;
        const tot = r.catRows.find((x) => x.c === c)?.v || 1;
        body = <WrList dkey={key} color={acc} emptyText="Nothing in this category." rows={rows.map((it) => ({ label: it.name, value: fmt(it.sum), sub: `${it.n}× · ${Math.round((it.sum / tot) * 100)}%`, frac: it.sum / max }))} />;
      }
    } else if (key === "income") {
      acc = "#3ddc97"; icon = "payments"; title = "Top income sources";
      const rows = r.srcList.slice(0, 10), max = rows[0]?.v || 1;
      body = <WrList dkey={key} color="#3ddc97" emptyText="No income logged." rows={rows.map((sr) => ({ label: sr.name, value: fmt(sr.v), valColor: "#8fd7a4", sub: `${sr.n}× · ${Math.round((sr.v / (r.incTot || 1)) * 100)}%`, frac: sr.v / max }))} />;
    } else if (key === "regular") {
      acc = "#b89cff"; icon = "storefront"; title = "Most frequent purchases";
      const rows = r.placeList.slice(0, 10), max = rows[0]?.n || 1;
      body = <WrList dkey={key} emptyText="No purchases with descriptions yet." rows={rows.map((pl) => ({ label: pl.name, value: `${pl.n}×`, valColor: "#cdbdff", sub: fmt(pl.sum), frac: pl.n / max, color: CAT_COLORS[pl.cat] }))} />;
    } else if (key === "rank") {
      acc = "#7fb6e0"; icon = "leaderboard"; title = `Best & worst ${unitWord}`;
      const top = r.ranked.slice(0, 5), bottom = [...r.ranked].reverse().slice(0, 5);
      const max = Math.max(1, ...r.ranked.map((u) => Math.abs(u.value)));
      const toRows = (arr) => arr.map((u) => ({ label: isYear ? u.label : `${u.label} ${MONTHS_SHORT[r.m]}`, value: signed(u.value),
        valColor: u.value >= 0 ? "#8fd7a4" : "#e2808c", frac: Math.abs(u.value) / max, color: u.value >= 0 ? "#3ddc97" : "#ff5d6c",
        sub: isYear ? `in ${fmt(u.inc)} · out ${fmt(u.sp)}` : `spent ${fmt(u.sp)}` }));
      body = (
        <div className="wr-two">
          <div><div style={{ ...S.wrLabel, color: "#8fd7a4" }}>Top 5 best</div><WrList dkey={key} rows={toRows(top)} emptyText="—" /></div>
          <div><div style={{ ...S.wrLabel, color: "#e2808c" }}>Top 5 worst</div><WrList dkey={key} rows={toRows(bottom)} emptyText="—" /></div>
        </div>
      );
    }
    return (
      <div className="wr-detail" style={{ "--acc": acc }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ ...S.wrLabel, marginBottom: 0, color: "#c7cdd2" }}><span className="msym wr-ico">{icon}</span>{title}</span>
          <button style={{ ...S.closeBtn, width: 26, height: 26 }} onClick={() => setRecapDetailOpen(false)}>✕</button>
        </div>
        {controls}
        {body}
      </div>
    );
  };

  const renderRecap = () => {
    const r = recapData;
    if (!r) return null;
    const isYear = r.kind === "year";
    const unitWord = isYear ? "month" : "day";
    const signed = (n, b, sp) => `${n >= 0 ? "+" : "−"}${fmtLive(Math.abs(n), b, sp && { from: Math.abs(sp.from), to: Math.abs(sp.to) })}`;
    const title = isYear ? `${r.y}` : `${MONTHS_FULL[r.m]} ${r.y}`;
    const kept = r.incTot > 0 ? Math.round(((r.incTot - r.spentTot) / r.incTot) * 100) : null;
    const underPct = r.logged ? Math.round((r.under / r.logged) * 100) : 0;
    const maxAbs = Math.max(1, ...r.units.filter((u) => u.has).map((u) => Math.abs(u.value)));
    const topCat = r.catRows[0];
    const catTotal = r.catRows.reduce((a, c) => a + c.v, 0) || 1;
    const group = (k) => (k && k.startsWith("cat") ? "cat" : k);
    const openGroup = recapDetailOpen ? group(recapDetail) : null;
    let tileN = 0;
    const tile = (cls, acc, detail, extra) => ({
      className: `wr-tile ${cls}${detail ? " clickable" : ""}${detail && openGroup === group(detail) ? " active" : ""}`,
      style: { "--acc": acc, animationDelay: `${120 + (tileN++) * 70}ms`, ...extra },
      ...(detail ? { onClick: () => toggleRecapDetail(detail), title: "Show top 10" } : {}),
    });
    const RING_R = 30, RING_C = 2 * Math.PI * RING_R;
    const hov = recapHover !== null ? r.units[recapHover] : null;

    return (
      <div style={{ ...S.backdrop, zIndex: 60, animation: recapClosing ? "fadeOut .22s ease both" : "fadeIn .22s ease backwards" }} onClick={closeRecap}>
        <div className="glass wr-modal" onClick={(e) => e.stopPropagation()}
             style={{ animation: recapClosing ? "modalPopOut .24s var(--ease-soft) both" : "modalPop .45s var(--ease) backwards" }}>
          <div style={S.modalHead}>
            <span style={S.wrKicker}>
              <span className="msym" style={{ fontSize: 17, color: "#c7cdd2" }}>auto_awesome</span>
              {isYear ? "Yearly" : "Monthly"} wrapped
            </span>
            <button style={S.closeBtn} onClick={closeRecap}>✕</button>
          </div>

          {r.empty ? (
            <div className="wr-tile wr-hero" style={{ "--acc": "#6d757d", minHeight: 220, animationDelay: "100ms" }}>
              <div style={S.wrLabel}>{title}</div>
              <div style={{ ...S.wrHeroNum, fontSize: 40, color: "#6d757d" }}>Nothing logged yet</div>
              <div style={S.wrHeroSub}>Add some expenses or income for this {isYear ? "year" : "month"} and your recap will fill in.</div>
            </div>
          ) : (
            <>
            <div className="wr-grid">
              {/* hero */}
              <div {...tile("wr-hero", r.total >= 0 ? "#3ddc97" : "#ff5d6c", null)}>
                <div style={S.wrLabel}>{title}</div>
                <div className="wr-hero-num" style={{ ...S.wrHeroNum,
                     backgroundImage: r.total >= 0 ? "linear-gradient(100deg, #ffffff 10%, #9ff2cb 55%, #3ddc97)" : "linear-gradient(100deg, #ffffff 10%, #ffb3ba 55%, #ff5d6c)" }}>
                  <CountNum value={r.total} duration={900} render={signed} />
                </div>
                <div style={S.wrHeroSub}>
                  {isYear ? "Net for the year (income − expenses)" : "PnL for the month against your daily limit"}
                  {kept !== null && <><br /><span style={{ color: "#e8eaec" }}>You kept <b>{Math.max(0, kept)}%</b> of the {fmt(r.incTot)} you earned.</span></>}
                </div>
                <div className="wr-bars" onMouseLeave={() => setRecapHover(null)}>
                  {hov && (
                    <div className="wr-bar-tip" style={{ left: `${Math.min(88, Math.max(12, ((recapHover + 0.5) / r.units.length) * 100))}%` }}>
                      <span style={{ color: "#8a9299", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                        {isYear ? hov.label : `${hov.label} ${MONTHS_SHORT[r.m]}`}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: !hov.has ? "#6d757d" : hov.value >= 0 ? "#8fd7a4" : "#e2808c" }}>
                        {hov.has ? `${hov.value >= 0 ? "+" : "−"}${fmt(Math.abs(hov.value))}` : "No data"}
                      </span>
                    </div>
                  )}
                  {r.units.map((u, k) => {
                    const h = u.has ? Math.max(4, (Math.abs(u.value) / maxAbs) * 100) : 4;
                    const dim = recapHover !== null && recapHover !== k;
                    return (
                      <div key={k} className="wr-bar-col" style={{ opacity: dim ? 0.4 : 1 }} onMouseEnter={() => setRecapHover(k)}>
                        <div className="wr-bar-half">
                          {u.has && u.value >= 0 && <span className="wr-bar up" style={{ height: `${h}%`, animationDelay: `${420 + k * (isYear ? 45 : 14)}ms` }} />}
                        </div>
                        <div className="wr-bar-half down">
                          {u.has && u.value < 0 && <span className="wr-bar dn" style={{ height: `${h}%`, animationDelay: `${420 + k * (isYear ? 45 : 14)}ms` }} />}
                          {!u.has && <span className="wr-bar none" />}
                        </div>
                        {(isYear || u.i === 1 || u.i % 5 === 0) && <span className="wr-bar-lbl">{isYear ? u.short.slice(0, 1) : u.short}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* best / worst */}
              <div {...tile("", "#3ddc97", "rank")}>
                <div style={S.wrLabel}><span className="msym wr-ico">north_east</span>Best {unitWord}</div>
                <div style={S.wrBig}>{r.best.label}</div>
                {!isYear && <div style={S.wrSmall}>{r.best.sub}</div>}
                <div style={{ ...S.wrValue, color: r.best.value >= 0 ? "#8fd7a4" : "#e2808c" }}>
                  <CountNum value={r.best.value} duration={800} render={signed} />
                </div>
                <span className="msym wr-more">arrow_outward</span>
              </div>
              <div {...tile("", "#ff5d6c", "rank")}>
                <div style={S.wrLabel}><span className="msym wr-ico">south_east</span>Worst {unitWord}</div>
                {r.worst ? (
                  <>
                    <div style={S.wrBig}>{r.worst.label}</div>
                    {!isYear && <div style={S.wrSmall}>{r.worst.sub}</div>}
                    <div style={{ ...S.wrValue, color: r.worst.value >= 0 ? "#8fd7a4" : "#e2808c" }}>
                      <CountNum value={r.worst.value} duration={800} render={signed} />
                    </div>
                  </>
                ) : <div style={{ ...S.wrBig, color: "#6d757d" }}>N/A</div>}
                <span className="msym wr-more">arrow_outward</span>
              </div>

              {/* average / discipline */}
              <div {...tile("", "#7fb6e0", "rank")}>
                <div style={S.wrLabel}><span className="msym wr-ico">equalizer</span>Avg {isYear ? "monthly" : "daily"} PnL</div>
                <div style={{ ...S.wrBig, color: r.avg >= 0 ? "#e8eaec" : "#e2808c" }}>
                  <CountNum value={r.avg} duration={800} render={signed} />
                </div>
                <div style={S.wrSmall}>across {r.active} active {unitWord}{r.active === 1 ? "" : "s"}</div>
                <span className="msym wr-more">arrow_outward</span>
              </div>
              <div {...tile("wr-row", "#e3cd77", null)}>
                <svg width="74" height="74" viewBox="0 0 74 74" style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
                  <circle cx="37" cy="37" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                  <circle className="wr-ring" cx="37" cy="37" r={RING_R} fill="none" stroke="#e3cd77" strokeWidth="7" strokeLinecap="round"
                          strokeDasharray={RING_C} style={{ "--ring-off": RING_C * (1 - underPct / 100), "--ring-c": RING_C }} />
                </svg>
                <div>
                  <div style={S.wrLabel}>Limit discipline</div>
                  <div style={S.wrBig}><CountNum value={underPct} duration={800} render={(n) => `${Math.round(n)}%`} /></div>
                  <div style={S.wrSmall}>{r.under} of {r.logged} logged days under the limit</div>
                </div>
              </div>

              {/* biggest expense category */}
              <div {...tile("wr-wide", topCat ? CAT_COLORS[topCat.c] : "#6d757d", topCat ? `cat:${topCat.c}` : null)}>
                <div style={S.wrLabel}><span className="msym wr-ico">local_fire_department</span>Biggest expense</div>
                {topCat ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
                      <span className="wr-cat-ico" style={{ color: CAT_COLORS[topCat.c], background: `${CAT_COLORS[topCat.c]}22` }}>
                        <span className="msym" style={{ fontSize: 24 }}>{CATS[topCat.c].icon}</span>
                      </span>
                      <div>
                        <div style={S.wrBig}>{CATS[topCat.c].label}</div>
                        <div style={S.wrSmall}>
                          <b style={{ color: "#e8eaec" }}>{fmt(topCat.v)}</b> · {Math.round((topCat.v / catTotal) * 100)}% of all spending
                        </div>
                      </div>
                    </div>
                    <div className="wr-stack">
                      {r.catRows.map((c, k) => (
                        <span key={c.c} className="wr-stack-seg"
                              onClick={(e) => { e.stopPropagation(); if (recapDetailOpen && recapDetail === `cat:${c.c}`) setRecapDetailOpen(false); else toggleRecapDetail(`cat:${c.c}`); }}
                              style={{ width: `${(c.v / catTotal) * 100}%`, background: CAT_COLORS[c.c], animationDelay: `${520 + k * 80}ms` }} />
                      ))}
                    </div>
                    <div style={S.wrLegend}>
                      {r.catRows.map((c) => (
                        <span key={c.c} className="wr-leg" onClick={(e) => { e.stopPropagation(); setRecapDetail(`cat:${c.c}`); if (!recapDetailOpen) toggleRecapDetail(`cat:${c.c}`); }}>
                          <i style={{ background: CAT_COLORS[c.c] }} />{CATS[c.c].label} {Math.round((c.v / catTotal) * 100)}%
                        </span>
                      ))}
                    </div>
                  </>
                ) : <div style={{ ...S.wrBig, color: "#6d757d" }}>No expenses</div>}
                <span className="msym wr-more">arrow_outward</span>
              </div>

              {/* best income source */}
              <div {...tile("", "#3ddc97", r.src ? "income" : null)}>
                <div style={S.wrLabel}><span className="msym wr-ico">payments</span>Top income source</div>
                {r.src ? (
                  <>
                    <div style={S.wrBig}>{r.src.name}</div>
                    <div style={{ ...S.wrValue, color: "#8fd7a4" }}><CountNum value={r.src.v} duration={800} render={fmtLive} /></div>
                    <div style={S.wrSmall}>{Math.round((r.src.v / (r.incTot || 1)) * 100)}% of income</div>
                    <span className="msym wr-more">arrow_outward</span>
                  </>
                ) : <div style={{ ...S.wrBig, color: "#6d757d" }}>No income</div>}
              </div>

              {/* most visited */}
              <div {...tile("", "#b89cff", r.placeList.length ? "regular" : null)}>
                <div style={S.wrLabel}><span className="msym wr-ico">storefront</span>Your regular</div>
                {r.place ? (
                  <>
                    <div style={S.wrBig}>{r.place.name}</div>
                    <div style={{ ...S.wrValue, color: "#cdbdff" }}>{r.place.n}×</div>
                    <div style={S.wrSmall}>{fmt(r.place.sum)} in total</div>
                  </>
                ) : (
                  <>
                    <div style={S.wrBig}>{r.tx}</div>
                    <div style={S.wrSmall}>transactions logged</div>
                  </>
                )}
                {r.placeList.length > 0 && <span className="msym wr-more">arrow_outward</span>}
              </div>
            </div>

            {/* top-10 panel that opens under the grid */}
            <div ref={recapDetailRef} style={{ display: "grid", gridTemplateRows: recapDetailOpen ? "1fr" : "0fr",
                 transition: "grid-template-rows .38s cubic-bezier(0.4,0,0.2,1)" }}>
              <div style={{ overflow: "hidden", minHeight: 0 }}>
                <div style={{ paddingTop: 12, opacity: recapDetailOpen ? 1 : 0, transform: recapDetailOpen ? "none" : "translateY(-10px)",
                              transition: "opacity .28s ease, transform .32s cubic-bezier(0.22,1,0.36,1)" }}>
                  {recapDetail && renderRecapDetail(r, (v) => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v))}`)}
                </div>
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    );
  };

  /* ---------- insights drop-down (inside money flow) ---------- */
  const TONE = { bad: "#e2808c", warn: "#e3cd77", good: "#8fd7a4", neutral: "#9aa3ab" };
  const toggleIns = () => {
    if (insOpen) {
      setInsClosing(true);
      setTimeout(() => { setInsOpen(false); setInsClosing(false); }, 300);
    } else { setInsOpen(true); setInsRun((n) => n + 1); }
  };
  const renderInsights = () => (
    <div className="ins-box">
      <button className="ins-head" onClick={toggleIns}>
        <span className="msym" style={{ fontSize: 18, color: "#c7cdd2" }}>lightbulb</span>
        <span style={S.insTitle}>Insights</span>
        {insights.length > 0 && <span className="ins-count">{insights.length}</span>}
        <span style={{ flex: 1 }} />
        <span className={`plain-arrow chev${insOpen && !insClosing ? " up" : ""}`}><Chevron /></span>
      </button>
      <div style={{ display: "grid", gridTemplateRows: insOpen && !insClosing ? "1fr" : "0fr",
                    transition: "grid-template-rows .34s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div key={`ins-${insRun}-${year}-${month}`} style={{ padding: "4px 2px 6px",
               opacity: insClosing ? 0 : 1, transform: insClosing ? "translateY(-10px)" : "none",
               transition: "opacity .24s ease, transform .28s cubic-bezier(0.4,0,0.2,1)" }}>
            {insights.length === 0 ? (
              <div style={S.insEmpty}>Not enough data yet. Insights appear once you've logged a few days.</div>
            ) : insights.map((it, i) => (
              <div key={it.key} className="ins-row" style={{ animationDelay: `${60 + i * 55}ms` }}>
                <span className="ins-ico" style={{ color: TONE[it.tone], background: `${TONE[it.tone]}1f` }}>
                  <span className="msym" style={{ fontSize: 17 }}>{it.icon}</span>
                </span>
                <span style={S.insText}>{it.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  /* ---------- goals ---------- */
  const renderGoals = () => {
    const mStart = keyOf(year, month, 1), mEnd = keyOf(year, month, daysInMonth);
    const isDone = (g) => g.target > 0 && goalSaved(g) >= g.target;
    const active = goals.filter((g) => !isDone(g)), completed = goals.filter(isDone);
    const renderGoalRow = (g, gi, list) => {
          const saved = goalSaved(g);
          const pct = g.target > 0 ? (saved / g.target) * 100 : 0;
          const done = pct >= 100;
          const thisMonth = (g.deposits || []).filter((d) => d.date >= mStart && d.date <= mEnd).reduce((a, d) => a + d.amount, 0);
          const open = fundGoal === g.id;
          return (
            <div key={g.id} className={`goal-row${goalLeaving === g.id ? " leaving" : ""}`}
                 style={{ animationDelay: `${gi * 60}ms`, position: "relative", zIndex: goalIconMenu === g.id ? 20 : "auto" }}>
              <div style={S.goalTop}>
                <span style={{ ...S.goalName, display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span className="goal-sym-wrap">
                    <button className={`goal-sym${goalIconMenu === g.id ? " open" : ""}`} title="Choose an icon"
                            onClick={() => setGoalIconMenu(goalIconMenu === g.id ? null : g.id)}>
                      <span key={goalIconOf(g)} className="msym goal-sym-ico" style={{ color: done ? "#8fd7a4" : undefined }}>{goalIconOf(g)}</span>
                    </button>
                    {goalIconMenu === g.id && (
                      <div className={`goal-sym-pop glass${gi >= 2 && gi >= list.length - 2 ? " up" : ""}`}>
                        <button className={`goal-sym-opt auto${!g.icon ? " on" : ""}`} title="Auto: pick from the goal's name" onClick={() => setGoalIcon(g.id, null)}>
                          <span className="msym" style={{ fontSize: 18 }}>auto_awesome</span><span>Auto</span>
                        </button>
                        {GOAL_ICONS.map((ic) => (
                          <button key={ic} className={`goal-sym-opt${g.icon === ic ? " on" : ""}`} onClick={() => setGoalIcon(g.id, ic)}>
                            <span className="msym" style={{ fontSize: 19 }}>{ic}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </span>
                  {editingGoal === g.id ? (
                    <input className="goal-name-input" value={editGoalName} autoFocus
                           style={{ width: `${Math.max(6, editGoalName.length + 1)}ch` }}
                           onChange={(e) => setEditGoalName(e.target.value)}
                           onBlur={commitRename}
                           onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingGoal(null); }} />
                  ) : (
                    <span className={`goal-name-text${done ? " done" : ""}`} title="Click to rename" onClick={() => startRename(g)}>{g.name}</span>
                  )}
                  {done && <span className="msym" style={{ fontSize: 15, color: "#8fd7a4", marginLeft: -2 }}>check_circle</span>}
                  {thisMonth !== 0 && (
                    <span style={{ ...S.goalNote, color: thisMonth > 0 ? "#8fd7a4" : "#e2808c" }}>
                      {thisMonth > 0 ? "+" : "−"}{fmt(Math.abs(thisMonth))} in {MONTHS_SHORT[month]}
                    </span>
                  )}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={S.goalAmt}>
                    <CountNum value={saved} duration={600} render={fmtLive} />
                    <span style={{ color: "#6d757d" }}> / {fmt(g.target)}</span>
                  </span>
                  <button className="goal-icon-btn" title={open ? "Close" : "Add or withdraw funds"}
                          onClick={() => { setFundGoal(open ? null : g.id); setFundAmt(""); }}>
                    <span className="msym" style={{ fontSize: 18, transform: open ? "rotate(45deg)" : "none", transition: "transform .3s cubic-bezier(0.34,1.3,0.64,1)" }}>add</span>
                  </button>
                  <button className="trash-btn" style={{ ...S.delBtn, marginLeft: 2 }} title="Delete goal" onClick={() => deleteGoal(g.id)}><TrashIcon /></button>
                </span>
              </div>
              <div style={S.goalBarRow}>
                <GoalBar key={`${g.id}-${goalsRun}`} pct={pct} done={done} delay={120 + gi * 60} />
                <span style={{ ...S.goalPct, color: done ? "#8fd7a4" : "#c7cdd2" }}>
                  <CountNum value={Math.floor(Math.min(999, pct))} duration={600} render={(n) => `${Math.round(n)}%`} />
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .3s cubic-bezier(0.4,0,0.2,1)" }}>
                <div style={{ overflow: "hidden", minHeight: 0 }}>
                  <div style={{ ...S.goalFundRow, opacity: open ? 1 : 0, transition: "opacity .24s ease" }}>
                    <AmountField value={open ? fundAmt : ""} setValue={setFundAmt} accent="green" cur={cur} width={150}
                                 ghost={needsGhost(fundAmt)} allowDecimal={isMYR} onSubmit={() => moveGoalFunds(g.id, 1)} />
                    <button className="goal-io in" title="Add to goal" onClick={() => moveGoalFunds(g.id, 1)}>
                      <span className="msym">download</span>
                    </button>
                    <button className="goal-io out" title="Withdraw from goal" onClick={() => moveGoalFunds(g.id, -1)}>
                      <span className="msym">upload</span>
                    </button>
                    {!done && g.target > saved && <span style={S.goalNote}>{fmt(g.target - saved)} to go</span>}
                  </div>
                </div>
              </div>
            </div>
          );
    };
    return (
      <div style={{ paddingTop: 4 }}>
        {goals.length === 0 && !newGoalOpen && (
          <div style={S.insEmpty}>No goals yet. Add one, like an emergency fund, and track it across the year.</div>
        )}
        {active.map((g, gi) => renderGoalRow(g, gi, active))}

        {/* completed goals: tucked away above "New goal", revealed with the drop-down */}
        {completed.length > 0 && (
          <div className="goal-done-box">
            <button className="goal-done-head" onClick={toggleDone}>
              <span className="msym" style={{ fontSize: 17, color: "#8fd7a4" }}>task_alt</span>
              <span>Completed</span>
              <span className="goal-done-count">{completed.length}</span>
              <span style={{ flex: 1 }} />
              <span className={`plain-arrow chev${doneOpen ? " up" : ""}`}><Chevron /></span>
            </button>
            <div style={{ display: "grid", gridTemplateRows: doneOpen ? "1fr" : "0fr", transition: "grid-template-rows .34s cubic-bezier(0.4,0,0.2,1)" }}>
              <div style={{ overflow: goalIconMenu && completed.some((g) => g.id === goalIconMenu) ? "visible" : "hidden", minHeight: 0 }}>
                <div style={{ opacity: doneOpen ? 1 : 0, transform: doneOpen ? "none" : "translateY(-8px)", transition: "opacity .26s ease, transform .3s cubic-bezier(0.22,1,0.36,1)" }}>
                  {doneMounted && completed.map((g, gi) => renderGoalRow(g, gi, completed))}
                </div>
              </div>
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateRows: newGoalOpen ? "1fr" : "0fr", transition: "grid-template-rows .32s cubic-bezier(0.4,0,0.2,1)" }}>
          <div style={{ overflow: "hidden", minHeight: 0 }}>
            <div style={{ ...S.goalFundRow, paddingTop: 12, opacity: newGoalOpen ? 1 : 0, transition: "opacity .24s ease" }}>
              <input style={{ ...S.darkInput, width: 190 }} placeholder="Goal, e.g. Emergency fund"
                     value={newGoalName} onChange={(e) => setNewGoalName(e.target.value)}
                     onKeyDown={(e) => { if (e.key === "Enter") addGoal(); }} />
              <AmountField value={newGoalTarget} setValue={setNewGoalTarget} accent="green" cur={cur} width={150}
                           ghost={needsGhost(newGoalTarget)} allowDecimal={isMYR} onSubmit={addGoal} />
              <button className="goal-save" onClick={addGoal} title="Save goal" aria-label="Save goal">
                <span className="msym" style={{ fontSize: 22 }}>check</span>
              </button>
            </div>
          </div>
        </div>
        <button className="goal-new" onClick={() => setNewGoalOpen((v) => !v)}>
          <span className="msym" style={{ fontSize: 17, transform: newGoalOpen ? "rotate(45deg)" : "none", transition: "transform .3s cubic-bezier(0.34,1.3,0.64,1)" }}>add</span>
          {newGoalOpen ? "Cancel" : "New goal"}
        </button>
      </div>
    );
  };

  /* ---------- dot add/remove animation ---------- */
  const [dotGhosts, setDotGhosts] = useState({});
  const prevDots = useRef({});
  useEffect(() => {
    const next = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const k = keyOf(year, month, d);
      const inc = monthIncomes.filter((it) => it.day === d).length;
      const exp = (spending[k] || []).length;
      next[k] = [...Array(inc).fill("g"), ...Array(exp).fill("r")];
      const before = prevDots.current[k] || [];
      if (before.length > next[k].length) {
        const removed = before.slice(next[k].length);
        setDotGhosts((g) => ({ ...g, [k]: removed }));
        setTimeout(() => setDotGhosts((g) => { const c = { ...g }; delete c[k]; return c; }), 240);
      }
    }
    prevDots.current = next;
  }, [spending, incomes, year, month, daysInMonth]);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  /* ===================== CHART ===================== */
  const renderChart = (mode) => (
    <div style={{ position: "relative" }}>
      {renderChartSvg(mode)}
      {hoverPt && <GlassTip key={hoverPt.label} W={720} H={380} x={Math.min(Math.max(hoverPt.x, 64 + 64), 720 - 20 - 64)}
                            y={hoverPt.y} below={hoverPt.y < 24 + 62} label={hoverPt.label} value={hoverPt.value} />}
    </div>
  );
  const renderChartSvg = (mode) => {
    const isMonthMode = mode === "month";
    const N = isMonthMode ? daysInMonth : 12;
    const W = 720, H = 380, PL = 64, PR = 20, PT = 24, PB = 44;
    const iw = W - PL - PR, ih = H - PT - PB;
    const X = isMonthMode ? (i) => PL + ((i + 1) / N) * iw : (i) => PL + ((i + 0.5) / N) * iw;
    const labelOf = (i) => (isMonthMode ? `${i + 1} ${MONTHS_SHORT[month]}` : `${MONTHS_SHORT[i]} ${year}`);
    const xTickEls = (isMonthMode
      ? Array.from({ length: Math.floor(N / 5) }, (_, k) => ({ x: PL + (((k + 1) * 5) / N) * iw, label: String((k + 1) * 5) }))
      : MONTHS_SHORT.map((nm, m) => ({ x: X(m), label: nm })));
    const Tooltip = ({ x, y, label, value }) => (
      <g className="ch-tip" pointerEvents="none">
        <line x1={x} y1={PT} x2={x} y2={PT + ih} stroke="#4a5055" strokeWidth="1" />
        <circle className="tip-dot" cx={x} cy={y} r="5" fill="#ffffff" />
      </g>
    );

    const GREY = "#6d757d";
    /* a segment is coloured when it joins consecutive days, grey when it bridges
       days with no entries; colours switch exactly at the data point */
    const colorStops = (pts, on, off) => {
      const o = (x) => Math.min(1, Math.max(0, (x - PL) / iw));
      const s = [];
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k];
        const c = b.i - a.i > 1 ? off : on;
        s.push({ o: o(a.x), c }, { o: o(b.x), c });
      }
      return s;
    };
    const HGrad = ({ id, pts, on, off }) => (
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={PL} y1="0" x2={PL + iw} y2="0">
        {colorStops(pts, on, off).map((s, k) => <stop key={k} offset={s.o} stopColor={s.c} />)}
      </linearGradient>
    );

    if (chartMode === "both") {
      const net = [], has = [];
      for (let i = 0; i < N; i++) {
        let raw;
        if (isMonthMode) {
          const e = chart.exp[i], ic = chart.inc[i];
          raw = e === null && ic === null ? null : (ic || 0) - (e || 0);
        } else {
          const m = yearStats.months[i];
          raw = !m.hasData && m.income === 0 ? null : m.income - m.spent;
        }
        has.push(raw !== null);
        net.push(raw || 0);
      }
      const hasAny = has.some(Boolean);
      let run = 0;
      const pts = [];
      for (let i = 0; i < N; i++) { run += net[i]; if (has[i]) pts.push({ i, x: X(i), v: run }); }
      const vals = pts.map((p) => p.v);
      const maxV = Math.max(0, ...vals), minV = Math.min(0, ...vals);
      const span = (maxV - minV) || 1;
      const Y = (v) => PT + ih - ((v - minV) / span) * ih;
      const zeroY = Y(0);
      pts.forEach((p) => { p.y = Y(p.v); });
      // start on the y-axis at zero so there's no gap before the 1st
      const full = pts.length ? [{ i: -1, x: PL, y: zeroY, v: 0 }, ...pts] : [];
      const linePath = smoothPath(full);
      const areaPath = full.length ? `${linePath} L ${full[full.length - 1].x} ${zeroY} L ${PL} ${zeroY} Z` : "";
      const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => minV + f * span);

      return (
        <svg key={`c-both-${mode}-${currency}`} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} onMouseLeave={() => setHoverPt(null)}>
          <defs>
            <linearGradient id="posFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3ddc97" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#3ddc97" stopOpacity="0.06" />
            </linearGradient>
            <linearGradient id="negFill" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ff5d6c" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#ff5d6c" stopOpacity="0.06" />
            </linearGradient>
            <linearGradient id="greyPosFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GREY} stopOpacity="0.34" />
              <stop offset="100%" stopColor={GREY} stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="greyNegFill" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={GREY} stopOpacity="0.34" />
              <stop offset="100%" stopColor={GREY} stopOpacity="0.05" />
            </linearGradient>
            <HGrad id="pnlLineG" pts={full} on="#3ddc97" off={GREY} />
            <HGrad id="pnlLineR" pts={full} on="#ff5d6c" off={GREY} />
            <HGrad id="pnlMaskData" pts={full} on="#fff" off="#000" />
            <HGrad id="pnlMaskEmpty" pts={full} on="#000" off="#fff" />
            <mask id="pnlDataMask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <rect x="0" y="0" width={W} height={H} fill="url(#pnlMaskData)" />
            </mask>
            <mask id="pnlEmptyMask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <rect x="0" y="0" width={W} height={H} fill="url(#pnlMaskEmpty)" />
            </mask>
            <clipPath id="above"><rect x="0" y="0" width={W} height={zeroY} /></clipPath>
            <clipPath id="below"><rect x="0" y={zeroY} width={W} height={H - zeroY} /></clipPath>
          </defs>
          <line className="axis-y" x1={PL} y1={PT} x2={PL} y2={PT + ih} stroke="#e8eaec" strokeWidth="2" />
          <line className="axis-x" x1={PL - 6} y1={PT + ih} x2={W - PR} y2={PT + ih} stroke="#e8eaec" strokeWidth="2" />
          {hasAny && yTicks.map((v, i) => (
            <g key={i} className="axis-fade" style={{ animationDelay: `${60 + i * 30}ms` }}>
              <text x={PL - 10} y={Y(v) + 4} fill="#8a9299" fontSize="11" textAnchor="end">{fmt(v)}</text>
              <line x1={PL} y1={Y(v)} x2={W - PR} y2={Y(v)} stroke="#2c3034" strokeWidth="1" />
            </g>
          ))}
          {xTickEls.map((t, i) => (
            <text key={i} className="axis-fade" style={{ animationDelay: `${60 + i * 18}ms` }} x={t.x} y={PT + ih + 20} fill="#8a9299" fontSize="11" textAnchor="middle">{t.label}</text>
          ))}
          {!hasAny ? (
            <text x={PL + iw / 2} y={PT + ih / 2 + 14} fill="#4a5055" fontSize="44" fontWeight="800" textAnchor="middle">N/A</text>
          ) : (
            <>
              <line x1={PL} y1={zeroY} x2={W - PR} y2={zeroY} stroke="#6d757d" strokeWidth="1" strokeDasharray="3 4" />
              <g className="area-rise" style={{ transformOrigin: `0px ${zeroY}px` }}>
                <g mask="url(#pnlDataMask)">
                  <path d={areaPath} fill="url(#posFill)" clipPath="url(#above)" />
                  <path d={areaPath} fill="url(#negFill)" clipPath="url(#below)" />
                </g>
                <g mask="url(#pnlEmptyMask)">
                  <path d={areaPath} fill="url(#greyPosFill)" clipPath="url(#above)" />
                  <path d={areaPath} fill="url(#greyNegFill)" clipPath="url(#below)" />
                </g>
              </g>
              <path className="line-sweep slow" pathLength="1" d={linePath} fill="none" stroke="url(#pnlLineG)" strokeWidth="2.6" strokeLinecap="round" clipPath="url(#above)" />
              <path className="line-sweep slow" pathLength="1" d={linePath} fill="none" stroke="url(#pnlLineR)" strokeWidth="2.6" strokeLinecap="round" clipPath="url(#below)" />
              {(() => {
                const ci = isMonthMode ? todayNum - 1 : (year === now.getFullYear() ? now.getMonth() : -1);
                const p = pts.find((q) => q.i === ci);
                return p ? <circle className="axis-fade" cx={p.x} cy={p.y} r="4" fill="#c7cdd2" /> : null;
              })()}
              {pts.map((p) => (
                <rect key={p.i} x={p.x - iw / N / 2} y={PT} width={iw / N} height={ih} fill="transparent" style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoverPt({ x: p.x, y: p.y, label: labelOf(p.i), value: fmt(p.v) })}
                      onClick={() => closeChart(() => {
                        if (isMonthMode) { setView("month"); setSelected(p.i + 1); }
                        else { setMonth(p.i); setView("month"); setSelected(null); }
                      })} />
              ))}
              {hoverPt && <Tooltip key={hoverPt.label} {...hoverPt} />}
            </>
          )}
        </svg>
      );
    }

    const expVals = isMonthMode ? chart.exp : yearStats.months.map((m) => (m.hasData ? m.spent : null));
    const incVals = isMonthMode ? chart.inc : yearStats.months.map((m) => (m.income > 0 ? m.income : null));
    const showExp = chartMode === "expense";
    const showInc = chartMode === "income";
    const vals = showExp ? expVals : incVals;
    const hasAny = vals.some((v) => v !== null);
    const maxVal = Math.max(1, ...vals.filter((v) => v !== null), showExp && isMonthMode ? dailyLimit : 0) * 1.12;
    const Y = (v) => PT + ih - (v / maxVal) * ih;
    const pts = [];
    if (showExp) expVals.forEach((v, i) => { if (v !== null) pts.push({ i, x: X(i), y: Y(v), v }); });
    // start on the y-axis at zero so there's no gap before the 1st
    const expFull = pts.length ? [{ i: -1, x: PL, y: Y(0), v: 0 }, ...pts] : [];
    const expLine = smoothPath(expFull);
    const yTicks = [0.25, 0.5, 0.75, 1].map((f) => f * maxVal);
    const curIdx = isMonthMode ? todayNum - 1 : (year === now.getFullYear() ? now.getMonth() : -1);
    // income columns fill ~72% of their slot so they read as solid bars but never touch
    const barW = Math.max(6, (iw / N) * 0.72);

    return (
      <svg key={`c-${chartMode}-${mode}-${currency}`} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} onMouseLeave={() => setHoverPt(null)}>
        <line className="axis-y" x1={PL} y1={PT} x2={PL} y2={PT + ih} stroke="#e8eaec" strokeWidth="2" />
        <line className="axis-x" x1={PL - 6} y1={PT + ih} x2={W - PR} y2={PT + ih} stroke="#e8eaec" strokeWidth="2" />
        {hasAny && yTicks.map((v, i) => (
          <g key={i} className="axis-fade" style={{ animationDelay: `${60 + i * 30}ms` }}>
            <text x={PL - 10} y={Y(v) + 4} fill="#8a9299" fontSize="11" textAnchor="end">{fmt(v)}</text>
            <line x1={PL} y1={Y(v)} x2={W - PR} y2={Y(v)} stroke="#2c3034" strokeWidth="1" />
          </g>
        ))}
        {xTickEls.map((t, i) => (
          <text key={i} className="axis-fade" style={{ animationDelay: `${60 + i * 18}ms` }} x={t.x} y={PT + ih + 20} fill="#8a9299" fontSize="11" textAnchor="middle">{t.label}</text>
        ))}
        {!hasAny ? (
          <text x={PL + iw / 2} y={PT + ih / 2 + 14} fill="#4a5055" fontSize="44" fontWeight="800" textAnchor="middle">N/A</text>
        ) : (
          <>
            {showInc && incVals.map((v, i) => v !== null ? (
              <rect key={"i" + i} className="bar-grow" style={{ animationDelay: `${120 + i * 18}ms`, cursor: "pointer" }}
                    x={X(i) - barW / 2} y={Y(v)} width={barW} height={PT + ih - Y(v)} rx={Math.min(6, barW / 4)} fill="#3ddc97" opacity="0.92"
                    onMouseEnter={() => setHoverPt({ x: X(i), y: Y(v), label: labelOf(i), value: fmt(v) })}
                    onClick={() => closeChart(() => {
                      if (isMonthMode) { setView("month"); setSelected(i + 1); }
                      else { setMonth(i); setView("month"); setSelected(null); }
                    })} />
            ) : null)}
            {showExp && expFull.length > 1 && (
              <>
                <defs><HGrad id="expLineG" pts={expFull} on="#ff5d6c" off={GREY} /></defs>
                <path className="line-sweep slow" pathLength="1" d={expLine} fill="none"
                      stroke="url(#expLineG)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
            {showExp && curIdx >= 0 && expVals[curIdx] !== null && (
              <circle className="axis-fade" cx={X(curIdx)} cy={Y(expVals[curIdx])} r="4" fill="#c7cdd2" />
            )}
            {showExp && pts.map((p) => (
              <rect key={p.i} x={p.x - iw / N / 2} y={PT} width={iw / N} height={ih} fill="transparent" style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoverPt({ x: p.x, y: p.y, label: labelOf(p.i), value: fmt(p.v) })}
                    onClick={() => closeChart(() => {
                      if (isMonthMode) { setView("month"); setSelected(p.i + 1); }
                      else { setMonth(p.i); setView("month"); setSelected(null); }
                    })} />
            ))}
            {hoverPt && <Tooltip key={hoverPt.label} {...hoverPt} />}
          </>
        )}
      </svg>
    );
  };

  const ChartButton = ({ title }) => (
    <button className="chart-btn" style={S.chartBtn} title={title} onClick={() => { setHoverPt(null); setChartOpen(true); }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect className="cb1" x="1" y="9" width="3" height="6" rx="1.5" fill="currentColor" />
        <rect className="cb2" x="6.5" y="5" width="3" height="10" rx="1.5" fill="currentColor" />
        <rect className="cb3" x="12" y="1" width="3" height="14" rx="1.5" fill="currentColor" />
      </svg>
    </button>
  );

  useEffect(() => {
    if (view !== "month" || !launched) { setWeekSeen(false); return; }
    const el = weekCardRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setWeekSeen(true); io.disconnect(); } });
    }, { threshold: 0.18 });
    io.observe(el);
    return () => io.disconnect();
  }, [view, launched, year, month]);

  useEffect(() => {
    if (view !== "month" || !launched) { setGoalsSeen(false); return; }
    const el = goalsCardRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setGoalsSeen(true); io.disconnect(); } });
    }, { threshold: 0.18 });
    io.observe(el);
    return () => io.disconnect();
  }, [view, launched, year, month]);

  useEffect(() => {
    if (view !== "month" || !launched) { setFlowSeen(false); return; }
    const el = flowCardRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setFlowSeen(true); io.disconnect(); } });
    }, { threshold: 0.18 });
    io.observe(el);
    return () => io.disconnect();
  }, [view, launched, year, month]);

  /* ---------- launch card (3D tilt + cursor light) ---------- */
  const cardRef = useRef(null);
  const targetTilt = useRef({ rx: 0, ry: 0 });
  const targetSpot = useRef({ x: 50, y: 50 });
  const [hoverCard, setHoverCard] = useState(false);
  const [phase, setPhase] = useState(1);   // 1 = wallet, 2 = card pulled out
  const [picked, setPicked] = useState("platinum");
  const [activeWallet, setActiveWallet] = useState(0);
  const [greetOn, setGreetOn] = useState(false);
  const [greetExit, setGreetExit] = useState(false);

  /* Tilt + cursor light are written straight to CSS variables (--rx, --ry, --sx, --sy) on <html>.
     No React state is touched, so the app never re-renders for this, and the loop stops once settled. */
  const launchRef = useRef(null);
  const walletExp = (w) => (w ? `12-${String((now.getFullYear() + (w.year || 0)) % 100).padStart(2, "0")}` : "");
  const tiltCur = useRef({ rx: 0, ry: 0, sx: 50, sy: 50 });
  const tiltRaf = useRef(0);
  // written straight onto the few elements that move; nothing inherited, so the other card faces never repaint
  const phaseRef = useRef(1), hoverRef = useRef(false);
  const writeTilt = () => {
    const root = launchRef.current;
    if (!root) return;
    const c = tiltCur.current;
    const tr = `rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg)`;
    root.querySelectorAll(".wallet-unit").forEach((u) => {
      const w = u.querySelector(".wallet-3d");
      if (w) w.style.transform = u.classList.contains("active") && phaseRef.current === 1 ? tr : "none";
    });
    const ct = root.querySelector(".card-tilt");
    if (ct) ct.style.transform = tr;
    root.querySelectorAll(".wallet-unit.active .shine-spot").forEach((el) => { el.style.transform = `translate3d(${(c.sx * 0.5).toFixed(2)}%, ${(c.sy * 0.5).toFixed(2)}%, 0)`; });
    const sheen = root.querySelector(".card-sheen");
    if (sheen) sheen.style.transform = `translateX(${(c.ry * 1.6).toFixed(2)}%) translateY(${(c.rx * -1.2).toFixed(2)}%)`;
    if (phaseRef.current === 2 && hoverRef.current) {            // gloss + rim only repaint while they're visible
      const gl = root.querySelector(".card-gloss"), ed = root.querySelector(".card-edge");
      if (gl) gl.style.background = `radial-gradient(circle 260px at ${c.sx.toFixed(1)}% ${c.sy.toFixed(1)}%, rgba(255,255,255,0.5), rgba(255,255,255,0.12) 38%, transparent 68%)`;
      if (ed) ed.style.background = `conic-gradient(from ${((c.sx - 50) * 3.6).toFixed(1)}deg at ${c.sx.toFixed(1)}% ${c.sy.toFixed(1)}%, rgba(255,255,255,0.75), rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.12) 72%, rgba(255,255,255,0.65) 100%)`;
    }
  };
  const stepTilt = () => {
    const c = tiltCur.current, tt = targetTilt.current, ts = targetSpot.current;
    c.rx += (tt.rx - c.rx) * 0.06; c.ry += (tt.ry - c.ry) * 0.06;
    c.sx += (ts.x - c.sx) * 0.09;  c.sy += (ts.y - c.sy) * 0.09;
    const done = Math.abs(tt.rx - c.rx) < 0.008 && Math.abs(tt.ry - c.ry) < 0.008
              && Math.abs(ts.x - c.sx) < 0.05 && Math.abs(ts.y - c.sy) < 0.05;
    if (done) { c.rx = tt.rx; c.ry = tt.ry; c.sx = ts.x; c.sy = ts.y; }
    writeTilt();
    tiltRaf.current = done ? 0 : requestAnimationFrame(stepTilt);
  };
  const kickTilt = () => { if (!tiltRaf.current) tiltRaf.current = requestAnimationFrame(stepTilt); };
  useEffect(() => () => { cancelAnimationFrame(tiltRaf.current); tiltRaf.current = 0; }, []);
  useLayoutEffect(() => { phaseRef.current = phase; hoverRef.current = hoverCard; writeTilt(); });

  // background light follows the cursor by moving composited layers — no re-render, no repaint
  const bgRaf = useRef(0), bgNext = useRef(null);
  const litWinRef = useRef(null), litInnerRef = useRef(null), glowRef = useRef(null);
  const placeBg = (x, y) => {
    if (litWinRef.current) litWinRef.current.style.transform = `translate3d(${x - 340}px, ${y - 340}px, 0)`;
    if (litInnerRef.current) litInnerRef.current.style.transform = `translate3d(${340 - x}px, ${340 - y}px, 0)`;
    if (glowRef.current) glowRef.current.style.transform = `translate3d(${x - 420}px, ${y - 420}px, 0)`;
  };
  useLayoutEffect(() => { if (!launched) placeBg(window.innerWidth * 0.5, window.innerHeight * 0.42); }, [launched]);
  const onVeilMove = (e) => {
    bgNext.current = [e.clientX, e.clientY];
    if (bgRaf.current) return;
    bgRaf.current = requestAnimationFrame(() => {
      bgRaf.current = 0;
      placeBg(bgNext.current[0], bgNext.current[1]);
    });
  };
  const onCardMove = (e) => {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    targetTilt.current = { ry: (px - 0.5) * 12, rx: -(py - 0.5) * 8.5 };
    targetSpot.current = { x: px * 100, y: py * 100 };
    kickTilt();
  };
  const onCardEnter = () => { setHoverCard(true); };
  const openCard = (which) => { setPicked(which); setPhase(2); onCardLeave(); };
  const walletLock = useRef(false);
  const stepWallet = (dir) => {
    setActiveWallet((cur) => {
      const next = Math.min(WALLETS.length - 1, Math.max(0, cur + dir));
      if (next !== cur) onCardLeave();
      return next;
    });
  };
  useEffect(() => {
    if (launched || phase !== 1) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      if (walletLock.current) return;
      walletLock.current = true;
      stepWallet(e.deltaY > 0 ? 1 : -1);
      setTimeout(() => { walletLock.current = false; }, 620);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [launched, phase]);
  const closeCard = () => { setPhase(1); onCardLeave(); };
  const onCardLeave = () => {
    setHoverCard(false);
    targetTilt.current = { rx: 0, ry: 0 };
    targetSpot.current = { x: 50, y: 50 };
    kickTilt();
  };
  const enterApp = () => {
    setLaunchExit(true);
    setTimeout(() => {
      setGreetOn(true);
      setYear(now.getFullYear() + (WALLETS[activeWallet]?.year || 0));
      setLaunched(true);
    }, 620);
    setTimeout(() => setGreetExit(true), 1620);          // greeting holds a full second, then fades
    setTimeout(() => {                                   // year intro starts right after
      setGreetOn(false);
      setGreetExit(false);
      setYearIntro(true);
    }, 1840);
  };
  const goHome = () => {
    setSelected(null);
    setCatView(null);
    setChartOpen(false);
    setCatMenu(null);
    cancelAnimationFrame(tiltRaf.current); tiltRaf.current = 0;
    tiltCur.current = { rx: 0, ry: 0, sx: 50, sy: 50 };
    targetTilt.current = { rx: 0, ry: 0 }; targetSpot.current = { x: 50, y: 50 };
    writeTilt();
    setLaunchExit(false);
    setLaunched(false);
    setPhase(1);
    setActiveWallet(0);
    setGreetOn(false);
    setGreetExit(false);
    setView("year");
  };

  return (
    <div style={S.page} onClick={() => { if (catMenu) closeCatMenu(); }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Ballet:opsz@16..72&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Mrs+Saint+Delafield&display=swap');

        html { background: #101215; }
        html, body { scroll-behavior: smooth; margin: 0; }
        body { background: transparent; }
        /* graphite backdrop for the yearly + monthly panels: a fixed GPU layer, so scrolling never repaints it */
        body::before {
          content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; will-change: transform;
          background:
            radial-gradient(1100px 720px at 8% -10%, rgba(168,182,198,0.17), transparent 62%),
            radial-gradient(900px 760px at 104% 26%, rgba(128,142,158,0.11), transparent 64%),
            radial-gradient(1000px 700px at 46% 118%, rgba(96,108,122,0.16), transparent 62%),
            radial-gradient(700px 500px at 70% 60%, rgba(255,255,255,0.025), transparent 70%),
            linear-gradient(172deg, #1f2327 0%, #191c20 38%, #14171a 70%, #0f1113 100%);
        }
        :root {
          --ease: cubic-bezier(0.22, 1, 0.36, 1);
          --ease-soft: cubic-bezier(0.32, 0.72, 0.24, 1);
          --glass: rgba(42, 46, 51, 0.52);
          --glass-hi: rgba(255, 255, 255, 0.10);
          --glass-line: rgba(255, 255, 255, 0.09);
        }

        /* everything cascades in when a month is opened from the year panel */
        .month-view.enter > * { animation: mvIn .62s var(--ease) backwards; }
        .month-view.enter > *:nth-child(1) { animation-delay: .00s; }
        .month-view.enter > *:nth-child(2) { animation-delay: .05s; }
        .month-view.enter > *:nth-child(3) { animation-delay: .09s; }
        .month-view.enter > *:nth-child(4) { animation-delay: .13s; }
        .month-view.enter > *:nth-child(5) { animation-delay: .17s; }
        .month-view.enter > *:nth-child(6) { animation-delay: .20s; }
        .month-view.enter > *:nth-child(7) { animation-delay: .23s; }
        .month-view.enter > *:nth-child(8) { animation-delay: .26s; }
        .month-view.enter > *:nth-child(n+9) { animation-delay: .30s; }
        @keyframes mvIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* the day tiles ride in a touch later, one after another */
        .month-view.enter .cell { animation: tileIn .5s var(--ease) backwards; }

        .cal-wrap {
          position: relative; border-radius: 20px; padding: 14px;
          margin: 0 -14px; overflow: hidden;
          background:
            linear-gradient(168deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 34%, rgba(255,255,255,0.006) 100%);
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
        }
        .cal-wrap::before {
          content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
          background:
            linear-gradient(112deg, transparent 18%, rgba(255,255,255,0.055) 34%, rgba(255,255,255,0.012) 44%, transparent 58%),
            radial-gradient(70% 50% at 8% -12%, rgba(255,255,255,0.09), transparent 62%);
        }
        .cal-wrap > * { position: relative; z-index: 1; }

        /* ---------- liquid glass surfaces ---------- */
        .glass {
          position: relative;
          background: var(--glass);
          backdrop-filter: blur(16px) saturate(135%);
          -webkit-backdrop-filter: blur(16px) saturate(135%);
          border: 1px solid var(--glass-line);
          box-shadow:
            0 18px 44px rgba(0,0,0,0.38),
            inset 0 1px 0 var(--glass-hi),
            inset 0 -1px 0 rgba(0,0,0,0.22);
          transition: box-shadow .45s var(--ease), border-color .45s var(--ease), transform .45s var(--ease);
        }
        /* the specular edge that makes it read as glass */
        .glass::before {
          content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
          z-index: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 20%, transparent 44%);
        }
        .glass > *, .cell > *, .ycell > * { position: relative; z-index: 1; }
        .glass:hover { border-color: rgba(255,255,255,0.16); box-shadow: 0 26px 60px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.16); }


        .glass-soft {
          background: rgba(36, 40, 45, 0.44);
          border: 1px solid rgba(255,255,255,0.07);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
        }

        ::selection { background: rgba(61,220,151,0.28); color: #f2f6fa; }
        ::-webkit-scrollbar { width: 11px; height: 11px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.10); border-radius: 99px;
          border: 3px solid transparent; background-clip: content-box;
        }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.20); background-clip: content-box; }

        /* inputs glow instead of jumping */
        input {
          transition: border-color .28s var(--ease), box-shadow .28s var(--ease), background .28s ease;
        }
        input:focus {
          box-shadow: 0 0 0 3px rgba(61,220,151,0.14);
          border-color: rgba(61,220,151,0.55) !important;
          outline: none !important;
        }
        .desc-field:focus { box-shadow: 0 0 0 3px rgba(154,163,171,0.14); border-color: rgba(200,210,220,0.45) !important; }
        .amt-field.red:focus { box-shadow: 0 0 0 3px rgba(255,93,108,0.16); border-color: rgba(255,93,108,0.6) !important; }

        /* buttons feel physical */
        button { transition: transform .22s var(--ease), background .22s ease, border-color .22s ease, color .22s ease; }
        button:active { transform: scale(0.965); }
        * { -webkit-font-smoothing: antialiased; }

        .stage-bg {
          position: fixed; inset: 0; z-index: 139; pointer-events: none;
          background: radial-gradient(circle at 50% 42%, #262b31 0%, #191d21 45%, #0d0f11 100%);
          opacity: 1; transition: opacity .43s ease;
        }
        .stage-bg.out { opacity: 0; }

        /* ---------- greeting (card -> year) ---------- */
        .greet-veil {
          position: fixed; inset: 0; z-index: 160;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          opacity: 1;
          transition: opacity .22s ease;
          pointer-events: none;
        }
        .greet-veil.out { opacity: 0; }
        .greet-title {
          font-size: clamp(34px, 5vw, 62px); font-weight: 700; letter-spacing: -0.02em; color: #94a2af;
          animation: greetRise .55s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes greetRise {
          from { opacity: 0; transform: translateY(34px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .greet-name {
          font-family: 'Ballet', cursive; font-weight: 400; color: #f4f7fa;
          font-size: clamp(86px, 12vw, 176px); line-height: 0.95; margin-top: -2px;
          animation: greetRise .6s cubic-bezier(0.22,1,0.36,1) .16s both;
        }

        /* ---------- year opening animation ---------- */
        .year-big-anim { animation: yearRise .65s cubic-bezier(0.22,1,0.36,1) both; display: inline-flex; align-items: flex-start; }
        @keyframes yearRise { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .year-intro {
          position: fixed; inset: 0; z-index: 155;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
        }
        .year-intro-text {
          position: relative; display: flex; font-weight: 800; letter-spacing: -0.02em;
          font-size: 240px; line-height: 1.02;
          transform-origin: 0% 50%;
          transition: transform .4s cubic-bezier(0.5,0,0.15,1);
        }
        .yi-ch {
          display: inline-block;
          /* brushed metal, lit from the middle */
          background-image:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 1px, rgba(28,33,38,0.10) 1px 2px),
            linear-gradient(103deg,
              #79828b 0%, #626b74 18%, #aab3bb 34%, #e3eaf0 46%,
              #98a1a9 58%, #6b747d 76%, #58616a 100%);
          background-size: auto, 100% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: chIn .38s cubic-bezier(0.22,1,0.36,1) both;
          transition: -webkit-text-fill-color .32s ease;
        }
        .yi-ch.settled { -webkit-text-fill-color: #e8eaec; }
        @keyframes chIn {
          from { opacity: 0; transform: translateY(64px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* the intro takes the texture of whichever card was pulled out */
        .yi-palladium .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(255,246,214,0.14) 0 1px, rgba(60,46,16,0.14) 1px 2px),
            linear-gradient(103deg, #a98a49 0%, #7d6430 18%, #f0dcab 42%, #8d7139 62%, #dcc48a 84%, #9a7d40 100%);
        }
        .yi-platinum .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0 1px, rgba(60,66,72,0.12) 1px 2px),
            linear-gradient(103deg, #b6bdc4 0%, #79818a 18%, #f6f8fa 42%, #838b94 62%, #dfe4e9 84%, #939ba3 100%);
        }
        .yi-coutts .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 1px, rgba(12,14,17,0.16) 1px 2px),
            linear-gradient(103deg, #6b7178 0%, #33383d 20%, #a8b0b8 44%, #2b2f34 66%, #7d848c 100%);
        }
        .yi-couttspurple .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(240,228,255,0.12) 0 1px, rgba(24,15,36,0.18) 1px 2px),
            linear-gradient(103deg, #7a5ea8 0%, #3a2856 20%, #d3bff0 44%, #33234c 66%, #8b6dbd 100%);
        }
        .yi-ivory .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(210,228,255,0.14) 0 1px, rgba(8,16,34,0.18) 1px 2px),
            linear-gradient(103deg, #3f6bb4 0%, #1a2c52 20%, #b8d0f4 44%, #16274a 66%, #4d7cc4 100%);
        }
        .yi-obsidian .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(206,238,222,0.14) 0 1px, rgba(6,24,18,0.18) 1px 2px),
            linear-gradient(103deg, #2f6b53 0%, #123326 20%, #a8dcc2 44%, #102c21 66%, #3a7d61 100%);
        }

        .year-nav {
          position: fixed; right: 26px; bottom: 26px; z-index: 30;
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          border-radius: 16px; padding: 7px 6px;
          background: rgba(255,255,255,0.055) !important;
          border: 1px solid rgba(255,255,255,0.16) !important;
          backdrop-filter: blur(22px) saturate(170%); -webkit-backdrop-filter: blur(22px) saturate(170%);
          box-shadow: 0 12px 30px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.22) !important;
        }
        .year-nav .ynav-btn { color: #cbd3db; }
        .ynav-btn {
          background: none; border: none; color: #8a9299; cursor: pointer;
          padding: 6px 8px; border-radius: 9px; line-height: 0;
          transition: color .18s ease, background .18s ease, transform .18s var(--ease-soft);
        }
        .ynav-btn svg { width: 17px; height: 17px; display: block; }
        .ynav-btn:hover:not(:disabled) { color: #e8eaec; background: rgba(255,255,255,0.08); }
        .ynav-btn:active:not(:disabled) { transform: scale(0.92); }
        .ynav-btn:disabled { opacity: 0.25; cursor: default; }

        /* ---------- year stack ---------- */
        .year-viewport { height: ${YEAR_BLOCK + 88}px; overflow: hidden; margin-top: 2px; }
        .year-track {
          transition: transform .5s var(--ease-soft);
          will-change: transform;
        }
        .year-track.shifting { opacity: 0.92; }
        .year-block {
          height: ${YEAR_BLOCK}px; padding-top: 4px;
          opacity: 0.13; transform: scale(0.965);
          transition: opacity .4s ease, transform .4s var(--ease-soft);
          cursor: pointer;
        }
        .year-block.active { opacity: 1; transform: scale(1); cursor: default; }
        .year-block-tag {
          font-size: 12px; font-weight: 700; color: #6d757d; letter-spacing: 0.12em;
          margin-bottom: 8px; opacity: 0; transition: opacity .4s ease;
        }
        .year-block:not(.active) .year-block-tag { opacity: 1; }

        /* ---------- launch screen ---------- */
        .launch-veil {
          position: fixed; inset: 0; z-index: 200; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          animation: veilIn .6s ease both;
        }
        .launch-veil.out { animation: veilOut .6s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes veilIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes veilOut { from { opacity: 1; } to { opacity: 0; visibility: hidden; } }

        .bg-dots {
          position: absolute; inset: -10%; pointer-events: none;
          background-image: radial-gradient(rgba(190,205,220,0.05) 1px, transparent 1.1px);
          background-size: 17px 17px;
        }
        .bg-dots.lit {
          background-image: radial-gradient(rgba(205,220,235,0.22) 1.1px, transparent 1.2px);
        }
        .bg-glow { position: absolute; left: 0; top: 0; width: 840px; height: 840px; pointer-events: none; will-change: transform;
                   background: radial-gradient(circle 420px at 50% 50%, rgba(190,205,220,0.07), transparent 70%); }
        .bg-lit-win { position: absolute; left: 0; top: 0; width: 680px; height: 680px; overflow: hidden; pointer-events: none; will-change: transform;
                      -webkit-mask-image: radial-gradient(circle 340px at 50% 50%, #000 0%, rgba(0,0,0,0.5) 50%, transparent 78%);
                      mask-image: radial-gradient(circle 340px at 50% 50%, #000 0%, rgba(0,0,0,0.5) 50%, transparent 78%); }
        .bg-lit-win .bg-dots.lit { inset: auto; left: -10vw; top: -10vh; width: 120vw; height: 120vh; will-change: transform; }

        .launch-wrap { position: static; }
        @keyframes wrapIn { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }

        /* ---------- stage: wallet (phase 1) -> card (phase 2) ---------- */

        .wallet-unit {
          position: fixed; left: 50%; top: 50%; z-index: 4;
          width: 452px; height: 344px;
          transform: translate(-50%, -50%);
          cursor: pointer; perspective: 1500px;
          /* pre-rasterised layer: sliding/scaling is a pure GPU move, no repaint, no first-frame hitch */
          will-change: transform, opacity;
          transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease;
        }
        .wallet-unit.side-right { transform: translate(-50%, -50%) translateX(430px) scale(0.56); opacity: 0.65; z-index: 3; }
        .wallet-unit.side-left  { transform: translate(-50%, -50%) translateX(-430px) scale(0.56); opacity: 0.65; z-index: 3; }
        .wallet-unit.side-right:hover, .wallet-unit.side-left:hover { opacity: 0.92; }
        /* two steps away: parked further out and out of reach until you step across */
        .wallet-unit.far.side-right { transform: translate(-50%, -50%) translateX(760px) scale(0.42); opacity: 0; pointer-events: none; }
        .wallet-unit.far.side-left  { transform: translate(-50%, -50%) translateX(-760px) scale(0.42); opacity: 0; pointer-events: none; }
        .phase2 .wallet-unit.active { transform: translate(-50%, calc(50vh - 96px)); }
        .phase2 .wallet-unit.side-right { transform: translate(-50%, -50%) translateX(660px) scale(0.45); opacity: 0; pointer-events: none; }
        .phase2 .wallet-unit.side-left  { transform: translate(-50%, -50%) translateX(-660px) scale(0.45); opacity: 0; pointer-events: none; }
        .wallet-3d {
          position: absolute; inset: 0; transform-style: preserve-3d;
          will-change: transform;            /* eased per-frame in JS, so no CSS transition on top */
        }

        .holder { position: absolute; inset: 0; }

        /* back wall + visible gusset edge */
        .hold-back {
          position: absolute; left: 0; right: 0; top: 48px; bottom: 0;
          border-radius: 16px;
          background: linear-gradient(180deg, #8d8172 0%, #6d6354 60%, #5d5445 100%);
          box-shadow: 0 30px 70px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14);
        }
        .hold-back::after {
          content: ""; position: absolute; inset: 0; border-radius: 16px;
          border: 1px solid rgba(40,33,24,0.45);
          background:
            radial-gradient(rgba(255,255,255,0.10) 0.6px, transparent 0.7px) 0 0 / 4px 4px,
            radial-gradient(rgba(0,0,0,0.16) 0.6px, transparent 0.7px) 2px 2px / 5px 5px;
          opacity: 0.6;
        }

        /* cards inside the pocket */
        .slot-card {
          position: absolute; left: 34px; width: 384px; height: 242px;
          border-radius: 11px; overflow: hidden; container-type: inline-size; z-index: 2;
          box-shadow: 0 6px 14px rgba(0,0,0,0.4);
          will-change: transform, opacity;
          transition: transform .85s cubic-bezier(0.22,1,0.36,1), opacity .4s ease;
        }
        /* back card: sits behind both pocket walls */
        .slot-card.gold { top: 10px; transform: rotate(-0.6deg); z-index: 2; }
        /* front card: sits inside the front pocket, ahead of the rear wall */
        .slot-card.plat { top: 92px; transform: rotate(0.35deg); z-index: 4; }
        .slot-card.taken { opacity: 0; transform: translateY(-46px); }

        /* front pocket with the puzzle panels */
        .puzzle-front {
          position: absolute; left: 0; right: 0; top: 48px; bottom: 0; z-index: 5;
          border-radius: 16px; overflow: hidden;
        }
        /* leather pocket walls that sit IN FRONT of the cards */
        .wall {
          position: absolute; left: 0; right: 0; bottom: 0;
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 -1px 0 rgba(255,255,255,0.10), 0 10px 26px rgba(0,0,0,0.4);
        }
        .wall-rear  { top: 118px; z-index: 3; }
        .puzzle-rear { border-radius: 14px; }
        .pz-skin {
          position: absolute; inset: 0;
          background:
            radial-gradient(120% 90% at 30% 8%, rgba(255,255,255,0.10), transparent 60%),
            linear-gradient(168deg, #8b7f6e 0%, #796d5d 45%, #6a5f50 100%);
        }
        .pz-skin::after {
          content: ""; position: absolute; inset: 0; opacity: 0.45; mix-blend-mode: overlay;
          background:
            radial-gradient(rgba(255,255,255,0.14) 0.6px, transparent 0.7px) 0 0 / 4px 4px,
            radial-gradient(rgba(0,0,0,0.18) 0.6px, transparent 0.7px) 2px 2px / 5px 5px;
        }
        .wall-front { top: 178px; z-index: 5; }
        .wall-lip {
          position: absolute; left: 0; right: 0; top: 0; height: 14px;
          background: linear-gradient(180deg, rgba(255,255,255,0.20), transparent);
        }
        .wall-lip::after {
          content: ""; position: absolute; left: 12px; right: 12px; top: 7px; height: 0;
          border-top: 1.5px dashed rgba(216,222,228,0.34);
        }
        .lp { position: absolute; inset: 0; }
        .lp-main {
          background:
            radial-gradient(120% 90% at 30% 10%, rgba(255,255,255,0.10), transparent 60%),
            linear-gradient(168deg, #8b7f6e 0%, #796d5d 42%, #6a5f50 78%, #5f5546 100%);
          clip-path: polygon(0 34%, 100% 8%, 100% 100%, 0 100%);
        }
        .lp-wedge {
          background:
            radial-gradient(120% 120% at 10% 90%, rgba(255,255,255,0.08), transparent 60%),
            linear-gradient(150deg, #7d7160 0%, #6b6051 100%);
          clip-path: polygon(0 34%, 0 100%, 72% 100%);
        }
        .lp-seam {
          position: absolute; left: -6%; width: 112%; top: 0; height: 0;
          border-top: 1.5px solid rgba(52,44,33,0.55);
          box-shadow: 0 1.5px 0 rgba(255,255,255,0.12);
          transform-origin: left center;
          top: 34%; transform: rotate(24.5deg);
        }
        .lp-seam::after {
          content: ""; position: absolute; left: 0; right: 0; top: 3px; height: 0;
          border-top: 1.5px dashed rgba(226,215,196,0.55);
        }
        /* stitched lip along the pocket opening */
        .lp-lip {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.16), transparent 14px);
          clip-path: polygon(0 34%, 100% 8%, 100% 11.5%, 0 37.5%);
        }
        .lp-lip::after {
          content: ""; position: absolute; inset: 0;
          background: repeating-linear-gradient(103deg,
            rgba(226,215,196,0.6) 0 5px, transparent 5px 11px);
          clip-path: polygon(0 38.5%, 100% 12.5%, 100% 14%, 0 40%);
        }
        /* perimeter stitching */
        .lp-stitch {
          position: absolute; inset: 8px; border-radius: 11px;
          border: 1.5px dashed rgba(226,215,196,0.5);
          clip-path: polygon(0 32%, 100% 6%, 100% 100%, 0 100%);
        }
        .anagram {
          position: absolute; right: 40px; bottom: 34px; width: 78px; height: 58px; opacity: 0.55;
          filter: drop-shadow(0 1px 0 rgba(255,255,255,0.18));
        }
        .anagram-dark { opacity: 0.42; filter: drop-shadow(0 1px 0 rgba(255,255,255,0.14)); }
        .leather-shine { position: absolute; inset: 0; pointer-events: none; transition: opacity .45s ease; overflow: hidden; }
        /* light spot is pre-painted once and slid with transform (200%-size box centred on the cursor) */
        .shine-spot { position: absolute; left: -100%; top: -100%; width: 200%; height: 200%; will-change: transform;
                      transform: translate3d(25%, 25%, 0); }

        /* ---------- Arena lambskin holder ---------- */
        .arena .hold-back {
          background: linear-gradient(180deg, #5c6166 0%, #45494e 60%, #34383c 100%);
        }
        .arena-wall { border-radius: 14px; }
        .ar-base {
          position: absolute; inset: 0;
          background:
            radial-gradient(120% 80% at 30% 8%, rgba(255,255,255,0.20), transparent 58%),
            radial-gradient(90% 70% at 82% 96%, rgba(0,0,0,0.30), transparent 66%),
            linear-gradient(168deg, #676c72 0%, #545a60 38%, #43484e 72%, #383c41 100%);
        }
        /* crinkled grain: overlapping crackle lines */
        .ar-crinkle {
          position: absolute; inset: 0; opacity: 0.9; mix-blend-mode: overlay;
          background-image:
            url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='220' height='220' filter='url(%23n)' opacity='0.55'/></svg>"),
            repeating-linear-gradient(41deg, rgba(255,255,255,0.10) 0 0.8px, transparent 0.8px 17px),
            repeating-linear-gradient(-27deg, rgba(255,255,255,0.08) 0 0.8px, transparent 0.8px 26px),
            repeating-linear-gradient(83deg, rgba(0,0,0,0.12) 0 0.8px, transparent 0.8px 21px),
            repeating-linear-gradient(-66deg, rgba(0,0,0,0.10) 0 0.8px, transparent 0.8px 31px);
          background-size: 220px 220px, auto, auto, auto, auto;
        }
        /* soft creases and worn patches */
        .ar-crinkle::after {
          content: ""; position: absolute; inset: 0; opacity: 0.55;
          background:
            radial-gradient(46% 26% at 22% 34%, rgba(255,255,255,0.16), transparent 70%),
            radial-gradient(38% 22% at 74% 58%, rgba(255,255,255,0.12), transparent 72%),
            radial-gradient(52% 30% at 58% 86%, rgba(0,0,0,0.20), transparent 74%),
            radial-gradient(30% 40% at 8% 72%, rgba(0,0,0,0.16), transparent 76%);
        }
        .ar-gloss {
          position: absolute; inset: 0; pointer-events: none;
          background:
            linear-gradient(158deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.06) 16%, transparent 30%),
            radial-gradient(70% 34% at 68% 90%, rgba(255,255,255,0.12), transparent 72%),
            linear-gradient(0deg, rgba(0,0,0,0.22) 0%, transparent 22%);
        }

        /* darker grey pockets sitting behind the cards */
        .arena .hold-back {
          background: linear-gradient(180deg, #3c4045 0%, #2e3236 60%, #24272b 100%);
        }
        /* the pocket behind the front card reads as a dark recess, like the back panel */
        .ar-pocket .ar-base {
          background:
            radial-gradient(120% 80% at 30% 8%, rgba(255,255,255,0.07), transparent 58%),
            linear-gradient(168deg, #3a3e43 0%, #2e3237 42%, #26292d 74%, #202327 100%);
        }
        .ar-pocket .ar-gloss { opacity: 0.3; }
        .ar-pocket .ar-crinkle { opacity: 0.55; }
        .ar-pocket::after {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(180deg, rgba(0,0,0,0.34), rgba(0,0,0,0.12) 26%, transparent 60%);
        }
        /* stitching toned to each panel, same U shape as the python holder */
        /* a single seam tracing the holder: down both sides, round the bottom.
           Drawn on top so it never doubles up where the panels overlap. */
        .seam-outline {
          position: absolute; left: 9px; right: 9px; top: 58px; bottom: 9px;
          border: 1.6px dashed; border-top: none; border-bottom: none; border-radius: 0;
          z-index: 4; pointer-events: none;
        }
        .seam-front {
          position: absolute; left: 9px; right: 9px; top: 0; bottom: 9px;
          border: 1.6px dashed; border-top: none; border-radius: 0 0 13px 13px;
          z-index: 7; pointer-events: none;
        }
        .seam-front-ar { border-color: rgba(24,27,31,0.92); }
        .seam-front-py { border-color: rgba(9,48,33,0.95); }
        .seam-arena  { border-color: rgba(24,27,31,0.9); }
        .seam-python { border-color: rgba(96,26,22,0.9); }
        /* the lower half of the python seam is sewn in dark green over the snakeskin */

        /* ---------- python holder ---------- */
        .py-wall { border-radius: 14px; }
        .python .hold-back {
          background:
            radial-gradient(120% 90% at 30% 8%, rgba(255,255,255,0.16), transparent 58%),
            linear-gradient(168deg, #c14a41 0%, #a83b34 52%, #8e2f2a 100%);
        }
        .python .hold-back::after {
          background:
            radial-gradient(rgba(255,255,255,0.20) 0.7px, transparent 0.8px) 0 0 / 5px 5px,
            radial-gradient(rgba(0,0,0,0.22) 0.7px, transparent 0.8px) 2.5px 2.5px / 6px 6px;
          border: 1.5px dashed rgba(150,54,46,0.6);
          border-radius: 16px; opacity: 1;
        }
        .py-skin { position: absolute; inset: 0; }
        .py-green {
          background:
            radial-gradient(120% 90% at 30% 10%, rgba(255,255,255,0.12), transparent 60%),
            linear-gradient(165deg, #2f7d5f 0%, #1d5a44 38%, #14402f 72%, #0e3325 100%);
        }
        .py-red {
          background:
            radial-gradient(rgba(255,255,255,0.18) 0.7px, transparent 0.8px) 0 0 / 5px 5px,
            radial-gradient(rgba(0,0,0,0.20) 0.7px, transparent 0.8px) 2.5px 2.5px / 6px 6px,
            radial-gradient(120% 90% at 30% 8%, rgba(255,255,255,0.16), transparent 58%),
            linear-gradient(168deg, #c14a41 0%, #a83b34 52%, #8e2f2a 100%);
        }
        .py-scales {
          position: absolute; inset: 0; opacity: 0.85;
          background-image:
            radial-gradient(ellipse 6px 4.4px at 50% 50%, rgba(255,255,255,0.16) 60%, transparent 64%),
            radial-gradient(ellipse 6px 4.4px at 50% 50%, rgba(0,0,0,0.42) 66%, transparent 70%),
            radial-gradient(ellipse 6px 4.4px at 50% 50%, rgba(255,255,255,0.13) 60%, transparent 64%),
            radial-gradient(ellipse 6px 4.4px at 50% 50%, rgba(0,0,0,0.38) 66%, transparent 70%);
          background-size: 15px 11px, 15px 11px, 15px 11px, 15px 11px;
          background-position: 0 0, 1.2px 1.4px, 7.5px 5.5px, 8.7px 6.9px;
        }
        .py-scales::after {
          content: ""; position: absolute; inset: 0; mix-blend-mode: overlay; opacity: 0.5;
          background:
            radial-gradient(60% 42% at 26% 34%, rgba(255,255,255,0.22), transparent 70%),
            radial-gradient(52% 38% at 74% 76%, rgba(0,0,0,0.30), transparent 72%);
        }

        /* ================= card faces ================= */
        .cf-pattern { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; }
        .cf-sheen-fixed {
          position: absolute; inset: 0; z-index: 2; pointer-events: none;
          background:
            linear-gradient(118deg, rgba(255,255,255,0.18) 0%, transparent 26%),
            radial-gradient(80% 60% at 78% 92%, rgba(0,0,0,0.2), transparent 70%);
        }
        .cf-content { z-index: 3; }
        .cf-exp { display: inline-flex; align-items: center; gap: 6px; }
        .cf-exp-lbl { font-size: 0.62em; line-height: 1.05; letter-spacing: 0.1em; opacity: 0.75; text-align: right; }

        /* wallet 1 · engraved gold (back) */
        .palladium .cf-metal {
          background:
            radial-gradient(90% 70% at 22% 12%, rgba(255,248,214,0.5), transparent 60%),
            linear-gradient(142deg, #d9bd7d 0%, #a98a49 22%, #f0dcab 42%, #9c7d3f 62%, #e2c98f 82%, #ad8e4d 100%);
        }
        .palladium .cf-grain {
          opacity: 0.5;
          background:
            radial-gradient(rgba(255,255,255,0.5) 0.5px, transparent 0.6px) 0 0 / 3px 3px,
            repeating-linear-gradient(100deg, rgba(255,255,255,0.16) 0 0.6px, rgba(90,70,25,0.10) 1.4px 2px);
        }
        .palladium .cf-pattern { color: #4a3712; mix-blend-mode: multiply; opacity: 0.9; filter: drop-shadow(0 1px 0 rgba(255,246,214,0.5)); }
        .palladium .cf-script { color: rgba(96,72,26,0.9); text-shadow: 0 1.2px 0 rgba(255,246,214,0.75), 0 -1px 1px rgba(50,36,10,0.45); }
        .palladium .cf-name, .palladium .cf-exp { color: rgba(92,70,26,0.88); text-shadow: 0 1px 0 rgba(255,246,214,0.65); }

        /* wallet 1 · engraved silver (front) */
        .platinum .cf-metal {
          background:
            radial-gradient(90% 70% at 24% 10%, rgba(255,255,255,0.55), transparent 60%),
            linear-gradient(142deg, #e9edf1 0%, #b6bdc4 22%, #f6f8fa 42%, #a9b0b7 62%, #e2e6ea 82%, #b9c0c7 100%);
        }
        .platinum .cf-grain {
          opacity: 0.45;
          background: repeating-linear-gradient(100deg, rgba(255,255,255,0.35) 0 0.5px, rgba(110,120,130,0.12) 1.4px 2px);
        }
        .platinum .cf-pattern { color: #4c565f; mix-blend-mode: multiply; opacity: 0.72; filter: drop-shadow(0 1px 0 rgba(255,255,255,0.65)); }
        .platinum .cf-script { color: rgba(96,105,115,0.9); text-shadow: 0 1.2px 0 rgba(255,255,255,0.9), 0 -1px 1px rgba(40,48,56,0.35); }
        .platinum .cf-name, .platinum .cf-exp { color: rgba(92,100,110,0.88); text-shadow: 0 1px 0 rgba(255,255,255,0.8); }

        /* wallet 2 · carbon weave (back) */
        .coutts .cf-metal {
          background: linear-gradient(146deg, #6b7278 0%, #3d4349 28%, #7d858c 50%, #363b41 76%, #616970 100%);
        }
        .coutts .cf-grain {
          opacity: 0.6;
          background:
            repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 4px),
            repeating-linear-gradient(-45deg, rgba(0,0,0,0.24) 0 2px, transparent 2px 4px);
        }
        .coutts .cf-script { color: rgba(214,222,230,0.9); text-shadow: 0 1.2px 0 rgba(255,255,255,0.18), 0 -1px 2px rgba(0,0,0,0.6); }
        .coutts .cf-name, .coutts .cf-exp { color: rgba(206,215,224,0.86); text-shadow: 0 1px 1px rgba(0,0,0,0.55); }

        /* wallet 2 · carbon weave, dark purple (front) */
        .couttspurple .cf-metal {
          background: linear-gradient(146deg, #7a5ea8 0%, #3a2856 28%, #8b6dbd 50%, #33234c 76%, #6b5296 100%);
        }
        .couttspurple .cf-grain {
          opacity: 0.6;
          background:
            repeating-linear-gradient(45deg, rgba(255,255,255,0.13) 0 2px, transparent 2px 4px),
            repeating-linear-gradient(-45deg, rgba(0,0,0,0.26) 0 2px, transparent 2px 4px);
        }
        .couttspurple .cf-script { color: rgba(232,220,250,0.9); text-shadow: 0 1.2px 0 rgba(255,255,255,0.16), 0 -1px 2px rgba(18,10,28,0.65); }
        .couttspurple .cf-name, .couttspurple .cf-exp { color: rgba(226,214,246,0.86); text-shadow: 0 1px 1px rgba(18,10,28,0.6); }

        /* wallet 3 · sapphire blue (front) */
        .ivory .cf-metal {
          background:
            radial-gradient(70% 55% at 84% 8%, rgba(240,226,178,0.5), transparent 56%),
            radial-gradient(80% 60% at 12% 96%, rgba(4,10,26,0.75), transparent 62%),
            linear-gradient(142deg, #3f6ec4 0%, #24447f 26%, #16294f 52%, #0c1730 74%, #1b3566 100%);
        }
        .ivory .cf-grain { opacity: 0.25; background: repeating-linear-gradient(100deg, rgba(255,255,255,0.2) 0 0.5px, rgba(0,0,0,0.16) 1.4px 2px); }
        .ivory .cf-pattern { color: #9fc0f0; mix-blend-mode: soft-light; opacity: 0.95; }
        .ivory .cf-script { color: rgba(126,166,224,0.92); text-shadow: 0 1.2px 0 rgba(190,214,248,0.3), 0 -1px 2px rgba(4,12,30,0.75); }
        .ivory .cf-name, .ivory .cf-exp { color: rgba(132,168,222,0.9); text-shadow: 0 1px 0 rgba(190,214,248,0.24), 0 -1px 1px rgba(4,12,30,0.65); }

        /* wallet 3 · deep green (back) */
        .obsidian .cf-metal {
          background:
            radial-gradient(70% 55% at 84% 8%, rgba(226,238,196,0.42), transparent 56%),
            radial-gradient(80% 60% at 12% 96%, rgba(3,16,11,0.75), transparent 62%),
            linear-gradient(142deg, #2f7458 0%, #1a4835 26%, #102c21 52%, #081a13 74%, #17402f 100%);
        }
        .obsidian .cf-grain { opacity: 0.25; background: repeating-linear-gradient(100deg, rgba(255,255,255,0.18) 0 0.5px, rgba(0,0,0,0.18) 1.4px 2px); }
        .obsidian .cf-pattern { color: #97cfb1; mix-blend-mode: soft-light; opacity: 0.95; }
        .obsidian .cf-script { color: rgba(112,180,146,0.92); text-shadow: 0 1.2px 0 rgba(180,224,202,0.28), 0 -1px 2px rgba(4,20,14,0.75); }
        .obsidian .cf-name, .obsidian .cf-exp { color: rgba(120,184,152,0.9); text-shadow: 0 1px 0 rgba(180,224,202,0.22), 0 -1px 1px rgba(4,20,14,0.65); }

        .anagram-py { opacity: 0.5; }


        /* the pulled-out card, centred on screen */
        .big-card {
          position: fixed; left: 50%; top: 50%; z-index: 12;
          width: min(560px, 84vw); height: min(340px, 44vh);
          cursor: pointer; perspective: 1300px;
          will-change: transform, opacity;
          transition: transform .95s cubic-bezier(0.22,1,0.36,1), opacity .5s ease;
        }
        .phase1 .big-card { opacity: 0; transform: translate(-50%, -50%) translateY(70px) scale(0.66); pointer-events: none; }
        .phase2 .big-card { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        .card-tilt { width: 100%; height: 100%; transform-style: preserve-3d; will-change: transform; }
        .big-card.out, .wallet-unit.out { animation: cardOut .55s cubic-bezier(0.5,0,0.75,0) both; }
        @keyframes cardOut { to { opacity: 0; transform: translate(-50%, -50%) translateY(-30px) scale(1.07); } }
        .launch-float { width: 100%; height: 100%; animation: floaty 7s ease-in-out infinite; transform-style: preserve-3d; }
        .launch-float.still { animation-play-state: paused; }
        @keyframes floaty {
          0%   { transform: translate3d(0, 0, 0) rotate(-0.25deg); }
          50%  { transform: translate3d(0, -12px, 0) rotate(0.25deg); }
          100% { transform: translate3d(0, 0, 0) rotate(-0.25deg); }
        }

        /* ---------- metal cards ---------- */
        .launch-card {
          container-type: inline-size;
          position: relative; width: 100%; height: 100%;
          border-radius: 20px; overflow: hidden; isolation: isolate;
          box-shadow: 0 34px 80px rgba(0,0,0,0.55);
          transition: box-shadow .4s ease;
        }
        .big-card:hover .launch-card { box-shadow: 0 46px 110px rgba(0,0,0,0.6); }

        .cardface { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; }
        .cf-metal { position: absolute; inset: 0; }
        /* very fine brushed grain — barely visible */
        .cf-grain {
          position: absolute; inset: 0; opacity: 0.28;
          background: repeating-linear-gradient(100deg,
            rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 0.5px,
            rgba(120,128,136,0.10) 1.5px, rgba(120,128,136,0.10) 2px);
        }
        .cf-content {
          position: absolute; inset: 0; padding: 8.5% 7%; z-index: 2;
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .sim { width: 13%; min-width: 34px; height: auto; margin-top: 8.5%; }
        /* the crocodile, top-left like an issuer's mark, in its original colours; the card's sheen passes over it */
        .cf-logo { position: absolute; left: 7cqw; top: 5.4cqw; width: 7.6cqw; height: auto; pointer-events: none; user-select: none;
                   filter: drop-shadow(0 0.25cqw 0.35cqw rgba(0,0,0,0.28)); }
        .cf-script {
          position: absolute; right: 7%; top: 12%;
          font-family: 'Mrs Saint Delafield', cursive; font-size: clamp(38px, 8.6cqw, 74px);
          color: rgba(58,63,69,0.78); line-height: 1;
          text-shadow: 0 1px 0 rgba(255,255,255,0.7), 0 -1px 1px rgba(0,0,0,0.18);
        }
        .cf-foot { display: flex; align-items: baseline; justify-content: space-between; }
        .cf-name {
          font-size: clamp(9px, 2.6cqw, 15px); font-weight: 600; letter-spacing: 0.18em; color: rgba(62,68,75,0.8);
          text-shadow: 0 1px 0 rgba(255,255,255,0.65);
        }
        .cf-exp {
          font-size: clamp(7px, 2cqw, 11px); font-weight: 600; letter-spacing: 0.14em; color: rgba(78,84,91,0.75);
          text-shadow: 0 1px 0 rgba(255,255,255,0.6);
        }

        .card-gloss { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen; transition: opacity .45s ease; z-index: 3; }
        .card-sheen {
          position: absolute; inset: -30%; pointer-events: none; mix-blend-mode: screen; z-index: 3;
          transition: opacity .45s ease;
          background: linear-gradient(100deg,
            transparent 32%, rgba(255,255,255,0.18) 44%, rgba(255,255,255,0.42) 50%,
            rgba(255,255,255,0.14) 56%, transparent 70%);
        }
        .card-edge {
          position: absolute; inset: 0; border-radius: 20px; padding: 1.4px; pointer-events: none; z-index: 4;
          transition: opacity .4s ease;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
        }
        .card-edge-blur.on { backdrop-filter: blur(7px) saturate(150%); -webkit-backdrop-filter: blur(7px) saturate(150%); animation: fadeIn .4s ease backwards; }
        .card-edge-blur {
          position: absolute; inset: 0; border-radius: 20px; padding: 7px; pointer-events: none; z-index: 4;
          transition: opacity .4s ease;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
        }

        /* ---------- leather card holder ---------- */


        .msym { font-family: 'Material Symbols Outlined'; font-weight: normal; font-style: normal; line-height: 1; letter-spacing: normal; text-transform: none; display: inline-block; white-space: nowrap; direction: ltr; -webkit-font-feature-settings: 'liga'; -webkit-font-smoothing: antialiased; transition: font-variation-settings .3s ease, transform .3s ease; }
        .cat-swap { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; overflow: hidden; }
        .cat-swap .glyph { position: absolute; transition: transform .26s cubic-bezier(0.34,1.25,0.64,1), opacity .2s ease; }
        .cat-swap .g-base { transform: scale(1); opacity: 1; }
        .cat-swap .g-hover { transform: scale(0.72); opacity: 0; }
        .cat-swap.on .g-base { transform: scale(1.28); opacity: 0; }
        .cat-swap.on .g-hover { transform: scale(1.18); opacity: 1; font-variation-settings: 'FILL' 1; }
        .ham-btn { transition: border-color .18s ease, color .18s ease; }
        .ham-btn:hover { border-color: #8a9299 !important; color: #e8eaec !important; }
        .ham-btn svg rect { transform-box: fill-box; }
        .ham-btn:hover .l1 { animation: hamSlide .34s cubic-bezier(0.55,0,0.35,1) 0s both; }
        .ham-btn:hover .l2 { animation: hamSlide .34s cubic-bezier(0.55,0,0.35,1) .07s both; }
        .ham-btn:hover .l3 { animation: hamSlide .34s cubic-bezier(0.55,0,0.35,1) .14s both; }
        @keyframes hamSlide {
          0% { transform: translateX(0); }
          46% { transform: translateX(16px); }
          47% { transform: translateX(-16px); }
          100% { transform: translateX(0); }
        }
        .flow-wrap.down { animation: flowDown .34s cubic-bezier(0.4,0,0.2,1) both; }
        .flow-wrap.up { animation: flowUp .34s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes flowDown { from { opacity: 0; transform: translateY(-26px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes flowUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }
        .dot-in { animation: dotIn .26s cubic-bezier(0.34,1.35,0.64,1) both; }
        .dot-out { animation: dotOut .22s ease both; }
        @keyframes dotIn { from { opacity: 0; transform: scale(0.2); } 70% { transform: scale(1.25); } to { opacity: 1; transform: scale(1); } }
        @keyframes dotOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.2); } }
        .bk-btn {
          background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.10);
          color: #8a9299; border-radius: 9px; padding: 4px 11px; font-size: 11.5px;
          font-weight: 600; letter-spacing: 0.04em; cursor: pointer;
          transition: color .18s ease, border-color .18s ease, background .18s ease;
        }
        .bk-btn:hover { color: #e8eaec; border-color: rgba(255,255,255,0.24); background: rgba(255,255,255,0.08); }
        /* recap */
        .recap-link { cursor: pointer; transition: opacity .18s ease, text-shadow .25s ease; }
        .recap-link:hover { opacity: .86; text-shadow: 0 0 22px rgba(255,255,255,0.18); }
        .wr-modal { border-radius: 24px; width: min(980px, 94vw); max-height: 90vh; overflow: auto; padding: 20px 22px 22px; transform-origin: center center;
                    background: radial-gradient(60% 50% at 0% 0%, rgba(61,220,151,0.10), transparent 70%),
                                radial-gradient(50% 60% at 100% 100%, rgba(127,182,224,0.10), transparent 70%), rgba(28,31,35,0.86) !important; }
        .wr-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: minmax(132px, auto); gap: 12px; margin-top: 8px; }
        .wr-tile { position: relative; overflow: hidden; border-radius: 18px; padding: 16px 18px;
                   background: radial-gradient(130% 120% at 0% 0%, color-mix(in srgb, var(--acc) 17%, transparent), transparent 62%), rgba(255,255,255,0.035);
                   border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
                   animation: wrIn .6s cubic-bezier(0.22,1,0.36,1) both; transition: transform .25s cubic-bezier(0.22,1,0.36,1), border-color .25s ease; }
        .wr-tile:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--acc) 40%, rgba(255,255,255,0.08)); }
        .wr-tile.wr-hero { grid-column: span 2; grid-row: span 2; display: flex; flex-direction: column; padding: 20px 22px 16px;
                   background: radial-gradient(90% 80% at 0% 0%, color-mix(in srgb, var(--acc) 24%, transparent), transparent 65%),
                               radial-gradient(70% 70% at 100% 100%, rgba(127,182,224,0.14), transparent 70%), rgba(255,255,255,0.04); }
        .wr-tile.wr-wide { grid-column: span 2; }
        .wr-tile.wr-row { display: flex; align-items: center; gap: 14px; }
        .wr-ico { font-size: 15px !important; color: var(--acc); }
        @keyframes wrIn { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
        .wr-bars { margin-top: auto; padding-top: 18px; display: flex; align-items: stretch; gap: 3px; height: 150px; }
        .wr-bar-col { flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative; padding-bottom: 16px; }
        .wr-bar-half { flex: 1; display: flex; align-items: flex-end; justify-content: center; }
        .wr-bar-half.down { align-items: flex-start; border-top: 1px solid rgba(255,255,255,0.12); }
        .wr-bar { display: block; width: 100%; max-width: 22px; border-radius: 5px; animation: wrGrow .7s cubic-bezier(0.22,1,0.36,1) both; }
        .wr-bar.up { background: linear-gradient(180deg, #7ef0bd, #3ddc97); transform-origin: bottom; border-radius: 5px 5px 2px 2px; }
        .wr-bar.dn { background: linear-gradient(0deg, #ff97a0, #ff5d6c); transform-origin: top; border-radius: 2px 2px 5px 5px; }
        .wr-bar.none { height: 3px; background: rgba(255,255,255,0.10); animation: none; margin-top: -2px; }
        @keyframes wrGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        .wr-bar-lbl { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); font-size: 10px; color: #6d757d; }
        .wr-bars { position: relative; }
        .wr-bar-col { cursor: default; transition: opacity .2s ease; }
        .wr-bar-tip { position: absolute; top: 0; transform: translate(-50%, -60%); z-index: 3; pointer-events: none;
                      display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 11px; border-radius: 10px;
                      background: rgba(24,27,31,0.92); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 8px 22px rgba(0,0,0,0.4);
                      white-space: nowrap; animation: tipIn .16s ease both; transition: left .18s cubic-bezier(0.22,1,0.36,1); }
        @keyframes tipIn { from { opacity: 0; transform: translate(-50%, -45%); } to { opacity: 1; transform: translate(-50%, -60%); } }
        .wr-tile.clickable { cursor: pointer; }
        .wr-tile.active { border-color: color-mix(in srgb, var(--acc) 65%, transparent);
                          box-shadow: 0 0 0 1px color-mix(in srgb, var(--acc) 35%, transparent), 0 10px 30px color-mix(in srgb, var(--acc) 14%, transparent); }
        .wr-more { position: absolute; top: 14px; right: 14px; font-size: 16px !important; color: #6d757d; opacity: 0;
                   transform: translate(-4px, 4px); transition: opacity .2s ease, transform .25s cubic-bezier(0.22,1,0.36,1), color .2s ease; }
        .wr-tile.clickable:hover .wr-more, .wr-tile.active .wr-more { opacity: 1; transform: none; color: var(--acc); }
        .wr-stack-seg, .wr-leg { cursor: pointer; }
        .wr-leg:hover { color: #e8eaec; }
        .wr-detail { border-radius: 18px; padding: 16px 18px 12px; border: 1px solid rgba(255,255,255,0.08);
                     background: radial-gradient(90% 140% at 0% 0%, color-mix(in srgb, var(--acc) 12%, transparent), transparent 60%), rgba(255,255,255,0.03); }
        .wr-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; }
        .wr-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 5px 10px; border-radius: 99px; cursor: pointer;
                   background: none; color: #8a9299; border: 1px solid rgba(255,255,255,0.1); transition: all .18s ease; }
        .wr-chip:hover { color: #e8eaec; }
        .wr-chip.on { color: var(--acc); border-color: color-mix(in srgb, var(--acc) 55%, transparent); background: color-mix(in srgb, var(--acc) 10%, transparent); }
        .wr-seg { display: inline-flex; padding: 2px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); }
        .wr-seg button { background: none; border: none; color: #8a9299; font-size: 12px; padding: 4px 10px; border-radius: 8px; cursor: pointer; transition: all .18s ease; }
        .wr-seg button.on { background: rgba(255,255,255,0.1); color: #e8eaec; }
        .wr-list { display: flex; flex-direction: column; }
        .wr-li { display: grid; grid-template-columns: 22px minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 8px 2px;
                 border-top: 1px solid rgba(255,255,255,0.05); animation: fadeRight .36s cubic-bezier(0.22,1,0.36,1) both; }
        .wr-li:first-child { border-top: none; }
        .wr-li-rank { font-size: 12px; font-weight: 800; color: #6d757d; text-align: center; font-variant-numeric: tabular-nums; }
        .wr-li-main { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .wr-li-name { font-size: 13.5px; font-weight: 600; color: #e8eaec; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wr-li-track { height: 5px; border-radius: 99px; background: rgba(255,255,255,0.06); overflow: hidden; }
        .wr-li-fill { display: block; height: 100%; border-radius: 99px; transform-origin: left; animation: wrGrowX .6s cubic-bezier(0.22,1,0.36,1) both; }
        .wr-li-val { display: flex; flex-direction: column; align-items: flex-end; font-size: 13.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .wr-li-sub { font-size: 11px; font-weight: 500; color: #6d757d; margin-top: 1px; }
        .wr-two { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
        @media (max-width: 760px) { .wr-two { grid-template-columns: 1fr; } }
        .wr-ring { animation: wrRing 1.1s cubic-bezier(0.22,1,0.36,1) .4s both; }
        @keyframes wrRing { from { stroke-dashoffset: var(--ring-c); } to { stroke-dashoffset: var(--ring-off); } }
        .wr-cat-ico { width: 46px; height: 46px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .wr-stack { display: flex; height: 10px; border-radius: 99px; overflow: hidden; margin-top: 14px; background: rgba(255,255,255,0.06); gap: 2px; }
        .wr-stack-seg { display: block; height: 100%; transform-origin: left; animation: wrGrowX .7s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes wrGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .wr-tile i { display: inline-block; width: 8px; height: 8px; border-radius: 3px; margin-right: 6px; }
        @media (max-width: 760px) {
          .wr-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .wr-tile.wr-hero, .wr-tile.wr-wide { grid-column: span 2; }
        }
        /* goals */
        .goal-row { padding: 13px 2px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); animation: fadeDown .42s cubic-bezier(0.22,1,0.36,1) both; }
        .goal-row.leaving { animation: goalOut .26s ease both; }
        @keyframes goalOut { to { opacity: 0; transform: translateX(14px); } }
        .goal-track { flex: 1; height: 9px; border-radius: 99px; background: rgba(255,255,255,0.07); overflow: hidden;
                      box-shadow: inset 0 1px 2px rgba(0,0,0,0.35); }
        .goal-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #4f8fd6, #7fb6e0);
                     box-shadow: 0 0 12px rgba(127,182,224,0.35);
                     transition: width .9s cubic-bezier(0.32,0.72,0.24,1), background .4s ease; }
        .goal-fill.done { background: linear-gradient(90deg, #3ddc97, #8ff0c4); box-shadow: 0 0 12px rgba(61,220,151,0.35); }
        .goal-icon-btn { background: none; border: none; color: #6d757d; cursor: pointer; padding: 3px; line-height: 0;
                         border-radius: 8px; transition: color .15s ease, background .15s ease; }
        .goal-icon-btn:hover { color: #e8eaec; background: rgba(255,255,255,0.07); }
        .goal-icon-btn.del:hover { color: #e2808c; }
        .goal-act.add { color: #8fd7a4; }
        .goal-new { display: inline-flex; align-items: center; gap: 6px; margin: 12px 0 4px; background: none;
                    border: 1px dashed rgba(255,255,255,0.16); color: #9aa3ab; border-radius: 10px; padding: 7px 12px;
                    font-size: 12.5px; cursor: pointer; transition: color .15s ease, border-color .15s ease, background .15s ease; }
        .goal-new:hover { color: #e8eaec; border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.04); }
        /* insights drop-down */
        .ins-box { margin-top: 14px; border-radius: 14px; background: rgba(255,255,255,0.03);
                   border: 1px solid rgba(255,255,255,0.07); padding: 2px 12px; }
        .ins-head { width: 100%; display: flex; align-items: center; gap: 8px; background: none; border: none;
                    cursor: pointer; padding: 11px 0; color: inherit; }
        .ins-head:hover .plain-arrow { color: #e8eaec; }
        .ins-count { font-size: 11px; font-weight: 700; color: #1e2124; background: #c7cdd2; border-radius: 99px;
                     padding: 1px 7px; line-height: 16px; }
        .ins-row { display: flex; align-items: flex-start; gap: 11px; padding: 9px 0;
                   border-top: 1px solid rgba(255,255,255,0.05); animation: fadeRight .38s cubic-bezier(0.22,1,0.36,1) both; }
        .ins-ico { flex-shrink: 0; width: 28px; height: 28px; border-radius: 9px; display: inline-flex;
                   align-items: center; justify-content: center; }
        .goal-name-text { cursor: text; border-radius: 5px; padding: 1px 3px; margin: -1px -3px; position: relative;
                          transition: background .15s ease, color .2s ease; }
        .goal-name-text:hover { background: rgba(255,255,255,0.06); }
        /* completed: a thin strike that draws itself across the name */
        .goal-name-text.done { color: #9aa3ab; }
        .goal-name-text.done::after { content: ""; position: absolute; left: 3px; right: 3px; top: 52%; height: 1.5px; border-radius: 1px;
                                      background: rgba(232,234,236,0.75); transform-origin: left; animation: strikeIn .5s cubic-bezier(0.22,1,0.36,1) .15s both; }
        @keyframes strikeIn { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .goal-name-input { font: inherit; color: #e8eaec; background: rgba(255,255,255,0.06); border: 1px solid rgba(127,182,224,0.55);
                           border-radius: 7px; padding: 2px 7px; outline: none; min-width: 6ch; max-width: 320px;
                           box-shadow: 0 0 0 3px rgba(127,182,224,0.12); animation: fadeIn .15s ease; }
        .goal-done-box { margin-top: 10px; border-radius: 13px; border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.025); padding: 0 12px; }
        .goal-done-head { width: 100%; display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer;
                          padding: 10px 0; color: #9aa3ab; font-size: 12.5px; font-weight: 600; }
        .goal-done-head:hover { color: #e8eaec; }
        .goal-done-head:hover .plain-arrow { color: #e8eaec; }
        .goal-done-count { font-size: 11px; font-weight: 700; color: #1e2124; background: #8fd7a4; border-radius: 99px; padding: 1px 7px; line-height: 16px; }
        .goal-done-box .goal-row:last-child { border-bottom: none; }
        .goal-sym-wrap { position: relative; display: inline-flex; }
        .goal-sym { background: none; border: none; padding: 0; margin: 0; cursor: pointer; line-height: 0; color: #c7cdd2;
                    transition: color .18s ease, transform .25s cubic-bezier(0.34,1.4,0.64,1); }
        .goal-sym:hover, .goal-sym.open { color: #ffffff; transform: scale(1.12); }
        .goal-sym-ico { font-size: 21px; animation: symIn .38s cubic-bezier(0.34,1.4,0.64,1) both; }
        @keyframes symIn { from { opacity: 0; transform: scale(.4) rotate(-20deg); } to { opacity: 1; transform: none; } }
        .goal-sym-pop { position: absolute; top: calc(100% + 8px); left: -8px; z-index: 30; width: 318px; padding: 8px; border-radius: 14px;
                        display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; animation: fadeDown .22s cubic-bezier(0.22,1,0.36,1) both;
                        box-shadow: 0 14px 34px rgba(0,0,0,0.45);
                        background: rgba(30,33,37,0.97) !important; border: 1px solid rgba(255,255,255,0.10); }
        .goal-sym-pop.up { top: auto; bottom: calc(100% + 8px); animation-name: fadeUpPop; }
        @keyframes fadeUpPop { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .goal-sym-opt { height: 34px; border: none; border-radius: 9px; background: none; color: #9aa3ab; cursor: pointer;
                        display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: background .15s ease, color .15s ease; }
        .goal-sym-opt:hover { background: rgba(255,255,255,0.08); color: #e8eaec; }
        .goal-sym-opt.on { background: rgba(127,182,224,0.16); color: #7fb6e0; }
        .goal-sym-opt.auto { grid-column: 1 / -1; justify-content: flex-start; padding: 0 10px; font-size: 12.5px; font-weight: 600; margin-bottom: 3px;
                             border-bottom: 1px solid rgba(255,255,255,0.06); border-radius: 9px 9px 0 0; }
        .goal-io, .goal-save { width: 38px; height: 38px; flex-shrink: 0; box-sizing: border-box; padding: 0; border-radius: 11px;
                    display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
                    transition: background .18s ease, border-color .18s ease, transform .15s ease, box-shadow .2s ease; }
        .goal-io .msym { font-size: 20px; transition: transform .25s cubic-bezier(0.34,1.4,0.64,1); }
        .goal-io.in  { color: #3ddc97; background: rgba(61,220,151,0.10); border: 1px solid rgba(61,220,151,0.32); }
        .goal-io.out { color: #ff5d6c; background: rgba(255,93,108,0.08); border: 1px solid rgba(255,93,108,0.30); }
        .goal-io.in:hover  { background: rgba(61,220,151,0.18); border-color: rgba(61,220,151,0.6); box-shadow: 0 0 16px rgba(61,220,151,0.22); }
        .goal-io.out:hover { background: rgba(255,93,108,0.15); border-color: rgba(255,93,108,0.55); box-shadow: 0 0 16px rgba(255,93,108,0.2); }
        .goal-io.in:hover .msym  { transform: translateY(2px); }
        .goal-io.out:hover .msym { transform: translateY(-2px); }
        .goal-io:active, .goal-save:active { transform: scale(0.94); }
        .goal-save { width: 38px; height: 38px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center;
                     cursor: pointer; color: #3ddc97; background: rgba(61,220,151,0.10); border: 1px solid rgba(61,220,151,0.32);
                     box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
                     transition: background .18s ease, border-color .18s ease, transform .15s ease, box-shadow .2s ease; }
        .goal-save:hover { background: rgba(61,220,151,0.18); border-color: rgba(61,220,151,0.6); box-shadow: 0 0 16px rgba(61,220,151,0.25), inset 0 1px 0 rgba(255,255,255,0.1); }
        .goal-save:hover .msym { transform: scale(1.12); }
        .goal-save:active { transform: scale(0.94); }
        .nospend-tag { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #a5efcd;
                       background: rgba(61,220,151,0.12); border: 1px solid rgba(61,220,151,0.25); border-radius: 99px; padding: 2px 8px; margin-top: 2px; }
        .nospend-row { background: rgba(61,220,151,0.06) !important; border-color: rgba(61,220,151,0.2) !important; gap: 10px; align-items: center; }
        .limit-label { background: none; border: none; padding: 4px 6px; margin: 0 -2px 0 0; border-radius: 7px; cursor: pointer;
                       user-select: none; transition: color .15s ease, background .15s ease; }
        .limit-label:hover { color: #e8eaec !important; background: rgba(255,255,255,0.05); }
        .limit-label:active { transform: scale(0.97); }
        .limit-flash { position: absolute; right: 0; bottom: calc(100% + 4px); font-size: 11.5px; font-weight: 600; color: #8fd7a4; white-space: nowrap;
                       animation: limitFlash 2.4s cubic-bezier(0.22,1,0.36,1) both; pointer-events: none; }
        @keyframes limitFlash { 0% { opacity: 0; transform: translateY(4px); } 12% { opacity: 1; transform: none; }
                                78% { opacity: 1; } 100% { opacity: 0; } }
        /* test-data settings pop-up */
        .tcfg-modal { border-radius: 24px; width: min(640px, 94vw); max-height: 90vh; overflow: auto; padding: 20px 22px 18px; transform-origin: center center;
                      background: radial-gradient(70% 50% at 0% 0%, rgba(227,205,119,0.08), transparent 70%), rgba(30,33,37,0.72) !important; }
        .tcfg-sub { font-size: 12.5px; color: #8a9299; margin: -2px 0 12px; line-height: 1.45; }
        .tcfg-sec { padding: 12px 0 10px; border-top: 1px solid rgba(255,255,255,0.07); }
        .tcfg-h { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; color: #9aa3ab; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 8px; }
        .tcfg-h .msym { font-size: 16px; color: #c7cdd2; }
        .tcfg-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; flex-wrap: wrap; }
        .tcfg-lbl { font-size: 13.5px; color: #c7cdd2; }
        .tcfg-ctl { display: inline-flex; align-items: center; gap: 8px; }
        .tcfg-to { font-size: 12px; color: #6d757d; }
        .tcfg-err { font-size: 12px; color: #ff8d97; margin: -2px 0 4px; text-align: right; }
        .tcfg-num { display: inline-flex; align-items: center; height: 34px; border-radius: 10px; background: rgba(24,27,31,0.6);
                    border: 1px solid rgba(255,255,255,0.10); overflow: hidden; transition: border-color .15s ease; }
        .tcfg-num:focus-within { border-color: rgba(127,182,224,0.6); box-shadow: 0 0 0 3px rgba(127,182,224,0.12); }
        .tcfg-num.bad { border-color: rgba(255,93,108,0.6); }
        .tcfg-num button { width: 28px; height: 100%; background: none; border: none; color: #9aa3ab; cursor: pointer; font-size: 16px; transition: color .15s, background .15s; }
        .tcfg-num button:hover { color: #e8eaec; background: rgba(255,255,255,0.06); }
        .tcfg-num input { width: 42px; background: none; border: none; outline: none; color: #e8eaec; font-size: 14px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
        .tcfg-unit { font-size: 12px; color: #8a9299; margin: 0 4px 0 3px; }
        .tcfg-seg { display: inline-flex; padding: 2px; border-radius: 11px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); }
        .tcfg-seg button { background: none; border: none; color: #8a9299; font-size: 12.5px; padding: 6px 11px; border-radius: 9px; cursor: pointer; transition: all .18s ease; white-space: nowrap; }
        .tcfg-seg button:hover { color: #e8eaec; }
        .tcfg-seg button.on { background: rgba(255,255,255,0.12); color: #ffffff; box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 2px 6px rgba(0,0,0,0.25); }
        .tcfg-styles { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
        .tcfg-style { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto auto; column-gap: 9px; row-gap: 2px; text-align: left;
                      padding: 10px 12px; border-radius: 13px; cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
                      color: inherit; transition: background .18s ease, border-color .18s ease, transform .18s var(--ease-soft); }
        .tcfg-style:hover { background: rgba(255,255,255,0.06); transform: translateY(-1px); }
        .tcfg-style.on { border-color: rgba(227,205,119,0.6); background: rgba(227,205,119,0.08); box-shadow: 0 0 0 1px rgba(227,205,119,0.25); }
        .tcfg-style-ico { grid-row: 1 / span 3; font-size: 20px !important; color: #9aa3ab; margin-top: 1px; }
        .tcfg-style.on .tcfg-style-ico { color: #e3cd77; }
        .tcfg-style-name { font-size: 13.5px; font-weight: 700; color: #e8eaec; }
        .tcfg-style-desc { font-size: 11.5px; color: #8a9299; line-height: 1.35; }
        .tcfg-style-est { font-size: 11px; color: #ff8d97; margin-top: 2px; font-variant-numeric: tabular-nums; }
        .tcfg-switch { width: 42px; height: 24px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.08); position: relative; cursor: pointer; transition: background .2s ease, border-color .2s ease; }
        .tcfg-switch span { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #c7cdd2; transition: transform .25s cubic-bezier(0.34,1.4,0.64,1), background .2s; }
        .tcfg-switch.on { background: rgba(61,220,151,0.35); border-color: rgba(61,220,151,0.55); }
        .tcfg-switch.on span { transform: translateX(18px); background: #ffffff; }
        .tcfg-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.07); }
        .tcfg-est { font-size: 12.5px; color: #9aa3ab; }
        .tcfg-go { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700;
                   color: #1a1d20; background: linear-gradient(180deg, #f0dc8e, #e3cd77); border: 1px solid rgba(255,255,255,0.3);
                   box-shadow: 0 6px 18px rgba(227,205,119,0.25), inset 0 1px 0 rgba(255,255,255,0.5); transition: transform .15s ease, filter .15s ease, opacity .15s; }
        .tcfg-go:hover { filter: brightness(1.06); transform: translateY(-1px); }
        .tcfg-go:active { transform: scale(0.97); }
        .tcfg-go:disabled { opacity: .4; cursor: not-allowed; transform: none; }
        .bk-btn.test { color: #e3cd77; border-color: rgba(227,205,119,0.3); }
        .bk-msg { color: #5ee3a9; font-size: 11.5px; animation: fadeRight .3s ease both; }
        /* crocodile home button in the footer: just the logo, no tile or outline */
        .foot-logo { background: none; border: none; outline: none; padding: 0; margin: 0 4px 0 0; cursor: pointer; line-height: 0;
                     -webkit-tap-highlight-color: transparent; }
        .foot-logo img { display: block; height: 30px; width: auto; user-select: none;
                         transition: transform .3s cubic-bezier(0.34,1.5,0.64,1), filter .25s ease; }
        .foot-logo:hover img { transform: translateY(-2px) scale(1.06); filter: brightness(1.08); }
        .foot-logo:active img { transform: scale(0.94); }
        .plain-arrow { background: none; border: none; color: #6d757d; cursor: pointer; line-height: 0; padding: 2px 4px; transition: color .15s ease; }
        .plain-arrow:hover { color: #e8eaec; }
        .chev svg { width: 15px; height: 15px; display: block; transform-origin: 50% 50%; }
        /* closed = 0deg (pointing down), open = 180deg; always turns clockwise */
        .chev svg { animation: chevDown .34s cubic-bezier(0.34,1.1,0.64,1) both; }
        .chev.up svg { animation: chevUp .34s cubic-bezier(0.34,1.1,0.64,1) both; }
        @keyframes chevUp   { from { transform: rotate(0deg); }   to { transform: rotate(180deg); } }
        @keyframes chevDown { from { transform: rotate(180deg); } to { transform: rotate(360deg); } }
        .flow-card { opacity: 0; visibility: hidden; transform: scale(0.94); }
        /* "backwards" + explicit end state: the animation lets go when it finishes. A held (both/forwards)
           animation blocks backdrop blur for anything inside the card, e.g. the glass chart tooltip. */
        .flow-card.shown { visibility: visible; opacity: 1; transform: none; animation: flowPopIn .5s cubic-bezier(0.22,1,0.36,1) backwards; }
        @keyframes flowPopIn {
          0%   { opacity: 0; transform: scale(0.94); }
          60%  { opacity: 1; transform: scale(1.012); }
          100% { opacity: 1; transform: scale(1); }
        }
        .flow-label { transition: background .16s ease; }
        .flow-label:hover { background: #33373b; }
        .score-arc { animation: scoreDraw 1s cubic-bezier(0.3,0,0.2,1) both; transform-origin: center; }
        @keyframes scoreDraw { from { stroke-dasharray: 0 9999; } }
        .bd-title { animation: bdTitleIn .3s cubic-bezier(0.34,1.15,0.64,1) both; }
        @keyframes bdTitleIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .bd-icon { display: inline-block; animation: bdIconRoll .4s cubic-bezier(0.55,0,0.35,1) both; }
        @keyframes bdIconRoll {
          0% { transform: translateY(0); filter: blur(0px); }
          42% { transform: translateY(-24px); filter: blur(2.5px); }
          43% { transform: translateY(24px); filter: blur(2.5px); }
          100% { transform: translateY(0); filter: blur(0px); }
        }
        .score-card { animation: bdItemIn .4s cubic-bezier(0.4,0,0.2,1) .12s both; }
        .sub-box { animation: subBoxIn .38s cubic-bezier(0.34,1.15,0.64,1) both; }
        @keyframes subBoxIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .bd-item { animation: bdItemIn .34s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes bdItemIn { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: translateY(0); } }
        .bd-fill { display: block; height: 100%; border-radius: 99px; animation: bdGrow .55s cubic-bezier(0.4,0,0.2,1) both; transform-origin: left center; }
        @keyframes bdGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        /* progressive left-to-right sweep (previous version kept below as .flow-rib) */
        .flow-wipe-rect {
          transform-box: fill-box; transform-origin: left center;
          animation: flowWipe .95s cubic-bezier(0.36,0.66,0.2,1) .1s both;
        }
        @keyframes flowWipe { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .flow-src { animation: flowSrcIn .4s cubic-bezier(0.22,1,0.36,1) both; transform-box: fill-box; transform-origin: center bottom; }
        @keyframes flowSrcIn { from { opacity: 0; transform: scaleY(0.2); } to { opacity: 1; transform: scaleY(1); } }
        .flow-rib { animation: fadeIn .5s ease both; }
        .flow-node { animation: flowNodeIn .4s cubic-bezier(0.34,1.2,0.64,1) both; }
        @keyframes flowNodeIn { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
        .mode-btn:hover {
          border-color: rgba(255,255,255,0.28) !important; color: #e8eaec !important;
          background: rgba(255,255,255,0.06) !important; transform: translateY(-1px);
        }
        .cat-btn-glow { box-shadow: 0 0 0 3px rgba(255,255,255,0.05); }
        .wk-tip { animation: wkTipIn .18s cubic-bezier(0.34,1.2,0.64,1) both; transform-box: fill-box; transform-origin: center bottom; }
        @keyframes wkTipIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        .cat-pop { animation: popUpIn .2s cubic-bezier(0.34,1.15,0.64,1) both; }
        .cat-pop.closing { animation: popDownOut .18s ease both; }
        @keyframes popUpIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popDownOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(10px); } }
        .cat-opt { transition: background .15s ease, color .15s ease; }
        .cat-opt:hover { background: #33373b !important; color: #e8eaec !important; }
        .icon-opt { transition: background .15s ease, color .15s ease; }
        .icon-opt:hover { background: #33373b !important; color: #f5d34b !important; }
        * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
        input { font-variant-numeric: tabular-nums; }
        .cell, .ycell {
          position: relative; overflow: hidden;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 14px rgba(0,0,0,0.26);
          transition: transform .24s var(--ease-soft), border-color .2s ease, box-shadow .24s ease;
          will-change: transform;
        }
        /* day tiles must not clip: their hover tooltip sits outside the tile */
        .cell { overflow: visible; }
        .cell:hover { z-index: 6; }
        .cell.tip-below .cell-tip { bottom: auto; top: calc(100% + 8px); }
        /* painted glass: a specular corner + a soft inner glow, no compositing cost */
        .cell::before, .ycell::before {
          content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
          background:
            linear-gradient(157deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 22%, transparent 46%),
            radial-gradient(120% 80% at 84% 108%, rgba(0,0,0,0.20), transparent 62%);
        }
        .cell:hover::before, .ycell:hover::before {
          background:
            linear-gradient(157deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.06) 24%, transparent 50%),
            radial-gradient(120% 80% at 84% 108%, rgba(0,0,0,0.18), transparent 62%);
        }
        .cell:hover, .ycell:hover {
          border-color: rgba(255,255,255,0.22) !important;
          transform: translateY(-2px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 22px rgba(0,0,0,0.3);
        }
        .cell:active, .ycell:active { transform: translateY(0) scale(0.99); }
        .month-btn:hover { color: #3ddc97; }
        .cur-btn:hover { border-color: #6a7178 !important; color: #e8eaec !important; }
        .cur-opt:hover { background: #33373b !important; }
        .chart-btn { transition: border-color .18s ease, color .18s ease; }
        .chart-btn:hover { border-color: #8a9299 !important; color: #e8eaec !important; }
        .chart-btn svg rect { transform-box: fill-box; transform-origin: center bottom; }
        .chart-btn:hover .cb1 { animation: riseBar .45s cubic-bezier(0.34,1.25,0.64,1) both; }
        .chart-btn:hover .cb2 { animation: riseBar .45s cubic-bezier(0.34,1.25,0.64,1) .07s both; }
        .chart-btn:hover .cb3 { animation: riseBar .45s cubic-bezier(0.34,1.25,0.64,1) .14s both; }
        @keyframes riseBar { from { transform: scaleY(0.2); } to { transform: scaleY(1); } }
        .collapse-btn { transition: border-color .18s ease, color .18s ease, transform .15s ease; }
        .collapse-btn:hover { border-color: #8a9299 !important; color: #ffffff !important; }
        .nav-arrow { background: none; border: none; color: #9aa3ab; font-size: 20px; cursor: pointer; padding: 0 4px; line-height: 1; transition: color .15s; }
        .nav-arrow:hover { color: #e8eaec; }
        .trash-btn { display: inline-flex; align-items: center; justify-content: center; transition: background .18s ease, border-color .18s ease, color .18s ease; }
        .trash-btn:hover { background: #ffb3bb !important; border-color: #ffb3bb !important; color: #111 !important; }
        .trash-lid { transition: transform .25s cubic-bezier(0.34, 1.4, 0.64, 1); transform-box: fill-box; transform-origin: 15% 85%; }
        .trash-btn:hover .trash-lid { transform: rotate(-26deg) translate(-1.5px, -1px); }
        .plus-btn span { display: inline-block; transition: transform .18s ease; }
        .plus-btn:hover span { transform: scale(1.25); }
        .draw-btn { display: inline-flex; align-items: center; justify-content: center; }
        .draw-btn svg rect { transform-box: fill-box; transform-origin: center center; }
        .draw-btn:hover .pi-h { animation: drawH .38s cubic-bezier(0.34,1.2,0.64,1) both; }
        .draw-btn:hover .pi-v { animation: drawV .38s cubic-bezier(0.34,1.2,0.64,1) .06s both; }
        @keyframes drawH { from { transform: scaleX(0.18); } to { transform: scaleX(1); } }
        @keyframes drawV { from { transform: scaleY(0.18); } to { transform: scaleY(1); } }
        .collapse-btn { overflow: hidden; }
        .collapse-btn span { display: inline-block; }
        .collapse-btn .ca-rot { transition: transform .38s cubic-bezier(0.34,1.3,0.64,1); }
        .collapse-btn:hover .ca-loop { animation: arrowLoop .42s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes arrowLoop {
          0% { transform: translateY(0); }
          49% { transform: translateY(22px); }
          50% { transform: translateY(-22px); }
          100% { transform: translateY(0); }
        }
        .chip-flip { will-change: transform; }
        .ghost-plus { background: none; border: 1px solid #3a3f44; color: #9aa3ab; transition: background .18s ease, color .18s ease, border-color .18s ease; }
        .ghost-plus:hover { background: #3ddc97 !important; border-color: #3ddc97 !important; color: #111 !important; font-weight: 800 !important; }
        .limit-input { background: transparent; border: 1px solid transparent; transition: background .2s ease, border-color .2s ease; }
        .limit-input:hover, .limit-input:focus { background: #26292c !important; border-color: #3a3f44 !important; outline: none; }
        .amt-field { transition: border-color .25s ease, box-shadow .25s ease; outline: none !important; }
        .amt-field.green:focus { border-color: #3ddc97 !important; box-shadow: 0 0 0 2px rgba(61,220,151,0.14); }
        .amt-field.red:focus { border-color: #ff5d6c !important; box-shadow: 0 0 0 2px rgba(255,93,108,0.14); }
        .desc-field { transition: border-color .25s ease, box-shadow .25s ease; outline: none !important; }
        .desc-field:focus { border-color: #9aa3ab !important; box-shadow: 0 0 0 2px rgba(154,163,171,0.12); }
        .entry-row { transition: border-color .2s ease; }
        .entry-row.inc:hover { border-color: #2f7d5c !important; }
        .entry-row.exp:hover { border-color: #8f3b45 !important; }
        .entry-row input { background: transparent; border: none; outline: none; }
        /* liquid-glass chart bubble */
        /* the outer box only positions; opacity/scale animate on the glass itself, because a fading
           parent would cut the blur off from the chart behind it */
        .glass-tip { position: absolute; z-index: 5; pointer-events: none; transform: translate(-50%, calc(-100% - 16px)); }
        .glass-tip-inner { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 104px; padding: 9px 16px 10px;
                     border-radius: 16px; white-space: nowrap; position: relative; overflow: hidden;
                     background: linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.07) 100%), rgba(22,25,29,0.38);
                     backdrop-filter: blur(26px) saturate(170%); -webkit-backdrop-filter: blur(26px) saturate(170%);
                     animation: glassTipIn .22s cubic-bezier(0.34,1.35,0.64,1) both; transform-origin: 50% 100%;
                     border: 1px solid rgba(255,255,255,0.22);
                     box-shadow: 0 16px 36px rgba(0,0,0,0.42), 0 2px 6px rgba(0,0,0,0.25),
                                 inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(255,255,255,0.06), inset 0 0 18px rgba(255,255,255,0.05); }
        .glass-tip-inner::before { content: ""; position: absolute; inset: 0 0 55% 0; border-radius: 16px 16px 40% 40%;
                     background: linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0)); pointer-events: none; }
        .glass-tip-label { position: relative; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(232,234,236,0.62); }
        .glass-tip-value { position: relative; font-size: 15px; font-weight: 800; color: #ffffff; font-variant-numeric: tabular-nums;
                     text-shadow: 0 1px 8px rgba(0,0,0,0.35); }
        @keyframes glassTipIn { from { opacity: 0; transform: translateY(8px) scale(.9); } to { opacity: 1; transform: none; } }
        .glass-tip.below { transform: translate(-50%, 16px); }
        .glass-tip.below .glass-tip-inner { transform-origin: 50% 0%; animation-name: glassTipInBelow; }
        @keyframes glassTipInBelow { from { opacity: 0; transform: translateY(-8px) scale(.9); } to { opacity: 1; transform: none; } }
        .tip-dot { filter: drop-shadow(0 0 6px rgba(255,255,255,0.55)); }
        /* in-page cards sit on a smooth fixed gradient: blurring it is visually identical but costs a full-card
           GPU blur on every scrolled frame. Real blur is kept for things that float over content. */
        .flow-card.glass { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
                .cell:hover > .cell-tip { backdrop-filter: blur(18px) saturate(150%) !important; -webkit-backdrop-filter: blur(18px) saturate(150%) !important; }
        .cell-tip {
          background: rgba(30,34,39,0.94) !important;
          border: 1px solid rgba(255,255,255,0.20) !important;
          box-shadow: 0 14px 30px rgba(0,0,0,0.5) !important;
          backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
          position: absolute; bottom: calc(100% + 8px); left: 50%;
          transform: translateX(-50%) translateY(5px) scale(0.95);
          opacity: 0; pointer-events: none;
          transition: opacity .18s ease, transform .18s ease; z-index: 20; white-space: nowrap;
        }
        .cell:hover .cell-tip { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        .row-wrap { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .26s cubic-bezier(0.4,0,0.2,1); }
        .row-wrap.collapsing { grid-template-rows: 0fr; }
        .axis-fade { animation: axisIn .35s ease both; }
        /* axes grow out of the origin */
        .axis-y {
          transform-box: fill-box; transform-origin: bottom center;
          animation: axisGrow .5s var(--ease) both;
        }
        .axis-x {
          transform-box: fill-box; transform-origin: left center;
          animation: axisGrow .6s var(--ease) .12s both;
        }
        @keyframes axisGrow { from { transform: scale3d(1,0.02,1); opacity: 0.4; } to { transform: scale3d(1,1,1); opacity: 1; } }
        .axis-x { animation-name: axisGrowX; }
        @keyframes axisGrowX { from { transform: scale3d(0.02,1,1); opacity: 0.4; } to { transform: scale3d(1,1,1); opacity: 1; } }

        /* one continuous sweep from the first point to the right */
        .line-sweep {
          stroke-dasharray: 1; stroke-dashoffset: 1;
          animation: drawLine 1.7s var(--ease-soft) .3s both;
        }
        .line-sweep.slow { animation-duration: 1.9s; animation-delay: .36s; }

        /* the gradient fill rises from the zero line */
        .area-rise {
          transform-box: view-box;
          animation: areaRise 1.1s var(--ease) .42s both;
        }
        @keyframes areaRise { from { transform: scaleY(0.04); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }

        /* chart tooltip settles smoothly between points */
        .ch-tip { animation: chTipIn .2s var(--ease) both; }
        @keyframes chTipIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .line-draw { stroke-dasharray: 1; animation: drawLine .55s ease both; }
        .bar-grow { animation: growBar .4s ease both; transform-box: fill-box; transform-origin: center bottom; }
        @keyframes axisIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes drawLine { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes growBar { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes fadeRight { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes tileIn {
          0%   { opacity: 0; transform: translateY(12px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.85); }
          25% { opacity: 0.6; }
          70% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(-14px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes panelOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-16px) scale(0.97); } }
        @keyframes popOutCenter {
          0% { opacity: 1; transform: scale(1); }
          45% { opacity: 0.85; transform: scale(1.06); }
          100% { opacity: 0; transform: scale(0.9); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes modalPop { 0% { opacity: 0; transform: scale(0.94) translateY(12px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes modalPopOut { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.96) translateY(8px); } }
      `}</style>

      {(!launched || greetOn || yearIntro) && (
        <div className={`stage-bg${yearIntro && introMove ? " out" : ""}`} />
      )}

      {!launched && (
        <div ref={launchRef} className={`launch-veil${launchExit ? " out" : ""}`}
             onMouseMove={onVeilMove}
             onClick={(e) => e.stopPropagation()}>

          {/* ambient dot field + cursor light on the background */}
          <div className="bg-dots" />
          {/* the lit dots are a pre-rendered circular window that slides with the cursor (GPU transform,
              no repaint); the pattern inside slides the opposite way so the dots stay aligned */}
          <div className="bg-lit-win" ref={litWinRef}><div className="bg-dots lit" ref={litInnerRef} /></div>
          <div className="bg-glow" ref={glowRef} />

          <div className={`launch-wrap phase${phase}`}>
            {/* ---- the card that gets pulled out ---- */}
            <div ref={cardRef}
                 className={`big-card${launchExit ? " out" : ""}`}
                 onMouseMove={phase === 2 ? onCardMove : undefined}
                 onMouseEnter={phase === 2 ? onCardEnter : undefined}
                 onMouseLeave={phase === 2 ? onCardLeave : undefined}
                 onClick={(e) => { e.stopPropagation(); if (phase === 2) enterApp(); }}>
              <div className="card-tilt">
                <div className={`launch-float${hoverCard || phase === 1 ? " still" : ""}`}>
                  <div className="launch-card">
                    <CardFace variant={picked} exp={walletExp(WALLETS.find((w) => w.cards.includes(picked)))} />
                    <div className="card-gloss" style={{
                          opacity: phase === 2 && hoverCard ? 1 : 0,
                        }} />
                    <div className="card-sheen" style={{
                          opacity: phase === 2 ? (hoverCard ? 0.9 : 0.4) : 0,
                        }} />
                    <div className="card-edge" style={{
                          opacity: phase === 2 && hoverCard ? 1 : 0,
                        }} />
                    {phase === 2 && hoverCard && <div className="card-edge-blur on" />}
                  </div>
                </div>
              </div>
            </div>

            {/* ---- card holders ---- */}
            {WALLETS.map((w, wi) => {
              const isActive = wi === activeWallet;
              const dist = wi - activeWallet;
              const side = dist < 0 ? "side-left" : "side-right";
              return (
                <div key={w.id}
                     className={`wallet-unit ${w.id} ${isActive ? "active" : side}${Math.abs(dist) > 1 ? " far" : ""}${launchExit ? " out" : ""}`}
                     onMouseMove={isActive && phase === 1 ? onCardMove : undefined}
                     onMouseEnter={isActive && phase === 1 ? onCardEnter : undefined}
                     onMouseLeave={isActive && phase === 1 ? onCardLeave : undefined}
                     onClick={(e) => {
                       e.stopPropagation();
                       if (!isActive) { if (phase === 1) { setActiveWallet(wi); onCardLeave(); } return; }
                       if (phase === 2) closeCard();
                     }}>
                  <div className="wallet-3d">
                    <div className="holder">
                      <div className="hold-back" />
                      {w.cards.map((variant, ci) => (
                        <div key={variant}
                             className={`slot-card ${ci === 0 ? "gold" : "plat"}${picked === variant && phase === 2 ? " taken" : ""}`}
                             onClick={(e) => {
                               e.stopPropagation();
                               if (!isActive) { setActiveWallet(wi); onCardLeave(); return; }
                               phase === 1 ? openCard(variant) : closeCard();
                             }}>
                          <CardFace variant={variant} exp={walletExp(w)} />
                        </div>
                      ))}
                      {w.id === "python" ? (
                        <PythonBody shine={
                          <div className="leather-shine" style={{ opacity: isActive && phase === 1 && hoverCard ? 1 : 0 }}>
                            <div className="shine-spot" style={{ background: "radial-gradient(circle 260px at 50% 50%, rgba(255,240,235,0.14), transparent 70%)" }} />
                          </div>} />
                      ) : w.id === "puzzle"
                        ? <PuzzleBody shine={
                            <div className="leather-shine" style={{ opacity: isActive && phase === 1 && hoverCard ? 1 : 0 }}>
                              <div className="shine-spot" style={{ background: "radial-gradient(circle 260px at 50% 50%, rgba(255,246,230,0.13), transparent 70%)" }} />
                            </div>} />
                        : <ArenaBody shine={
                            <div className="leather-shine" style={{ opacity: isActive && phase === 1 && hoverCard ? 1 : 0 }}>
                              <div className="shine-spot" style={{ background: "radial-gradient(circle 260px at 50% 50%, rgba(226,238,250,0.16), transparent 70%)" }} />
                            </div>} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {greetOn && (
        <div className={`greet-veil${greetExit ? " out" : ""}`}>
          <div className="greet-title">
            {now.getHours() < 12 ? "Good Morning," : now.getHours() < 18 ? "Good Afternoon," : "Good Evening,"}
          </div>
          <div className="greet-name">Rassam</div>
        </div>
      )}


      {launched && yearIntro && (
        <div className="year-intro">
          <div ref={introTextRef}
               className={`year-intro-text yi-${picked}${introMove ? " moving" : ""}`}
               style={introMove && introTarget
                 ? { transform: `translate(${introTarget.dx}px, ${introTarget.dy}px) scale(${introTarget.scale})` }
                 : undefined}>
            {String(year).split("").map((ch, i) => (
              <span key={i} className={`yi-ch${introMove ? " settled" : ""}`}
                    style={{ animationDelay: `${i * 55}ms` }}>{ch}</span>
            ))}
          </div>
        </div>
      )}

      {!launched ? null : view === "year" ? (
        <div ref={yearWrapRef}>
          <div className="year-shell" style={{ opacity: yearIntro ? 0 : 1 }}>
            <div style={S.yearHeader}>
              <div style={S.yearBigWrap}>
                <span ref={headerYearRef} className={`recap-link${yearRise ? " year-big-anim" : ""}`} style={S.yearBig}
                      title={`${year} wrapped`} onClick={() => openRecap({ kind: "year", y: year })}>
                  {String(year).slice(0, 3)}
                  <DigitRoll digit={Number(String(year).slice(3))} size={64} />
                </span>
              </div>
              <div style={S.yearBarWrap}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <SplitBar remainingVal={yearRemaining} totalVal={yearStats.income} frac={yearRemainFrac} animKey={`y${year}-${currency}-${yearIntro ? "i" : "l"}`} />
                  </div>
                  <ChartButton title="Yearly chart" />
                </div>
                <div style={S.barMeta}>
                  <span style={{ color: remainColor(yearRemaining) }}>
                    <strong><CountNum value={yearRemaining} duration={560} render={fmtLive} /></strong>
                    {" / "}{fmt(yearStats.income)}
                  </span>
                  <span style={{ color: "#ff5d6c" }}>
                    <CountNum value={yearStats.spent} duration={560} render={fmtLive} />
                  </span>
                </div>
              </div>
            </div>

            <div className="year-nav glass">
              <button className="ynav-btn" title="Previous year (↑)"
                      disabled={yearIdx === 0}
                      onClick={() => stepYear(-1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 15.5 L12 8.5 L19 15.5" />
                </svg>
              </button>
              <button className="ynav-btn" title="Next year (↓)"
                      disabled={yearIdx === YEARS.length - 1}
                      onClick={() => stepYear(1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 8.5 L12 15.5 L19 8.5" />
                </svg>
              </button>
            </div>

            <div className="year-viewport" key={`vp-${yearIntro ? "intro" : "live"}`}>
              <div className={`year-track${yearShift ? " shifting" : ""}`}
                   style={{ transform: `translateY(${-yearIdx * YEAR_BLOCK}px)` }}>
                {YEARS.map((yr, yi) => {
                  const st = allYearStats[yi];
                  const active = yr === year;
                  return (
                    <div key={yr} className={`year-block${active ? " active" : ""}`}
                         onClick={() => { if (!active) stepYear(yi - yearIdx); }}>
                      <div className="year-block-tag">{yr}</div>
                      <div style={S.yearGrid}>
                        {MONTHS_SHORT.map((name, m) => {
                          const ms = st.months[m];
                          const hasAnything = ms.hasData || ms.income > 0;
                          const profit = ms.income - ms.spent;
                          const isNow = yr === now.getFullYear() && m === now.getMonth();
                          const color = !hasAnything ? "#8a9299" : profit >= 0 ? "#3ddc97" : "#ff5d6c";
                          const bg = !hasAnything ? "#26292c" : profit >= 0 ? "rgba(61,220,151,0.08)" : "rgba(255,93,108,0.10)";
                          const border = isNow ? "#7fb6e0" : !hasAnything ? "#33373b" : profit >= 0 ? "#1e4436" : "#5a2830";
                          return (
                            <div key={name} className="ycell"
                                 style={{ ...S.yearCell, background: bg, borderColor: border,
                                          animation: active ? `tileIn .42s var(--ease) ${m * 22}ms backwards` : "none" }}
                                 onClick={() => { if (active) { setYear(yr); setMonth(m); setSelected(null); setFromYear(true); setView("month"); setTimeout(() => setFromYear(false), 1100); } }}>
                              <span style={S.yearCellName}>{name}</span>
                              {hasAnything ? (
                                <>
                                  <span style={{ ...S.yearCellSpent, color }}>
                                    <CountNum value={profit} duration={560}
                                              render={(n, b, sp) => `${n >= 0 ? "" : "-"}${fmtLive(Math.abs(n), b, sp)}`} />
                                  </span>
                                  <span style={S.yearCellExp}>
                                    <CountNum value={ms.spent} duration={560}
                                              render={(n, b, sp) => `-${fmtLive(n, b, sp)}`} />
                                  </span>
                                </>
                              ) : (
                                <span style={{ ...S.yearCellSpent, color: "#8a9299" }}>·</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={fromYear ? "month-view enter" : "month-view"}>
          <div style={S.topRow}>
            <h1 className="recap-link" style={S.title} title={`${MONTHS_FULL[month]} wrapped`}
                onClick={() => openRecap({ kind: "month", y: year, m: month })}>Monthly Calendar</h1>
            <div style={S.navBox}>
              <button className="nav-arrow" onClick={() => nav(-1)}>‹</button>
              <button className="month-btn" style={S.monthLabelBtn}
                      onClick={() => { setYearRise(true); setView("year"); setTimeout(() => setYearRise(false), 700); }}
                      title="View year">{monthLabel}</button>
              <button className="nav-arrow" onClick={() => nav(1)}>›</button>
              <button className="cur-btn" style={S.currency}
                      title="Switch currency"
                      onClick={(e) => { e.stopPropagation(); pickCurrency(isMYR ? "IDR" : "MYR"); }}>
                <CurrencyRoll idx={isMYR ? 1 : 0} />
              </button>
            </div>
          </div>

          <div style={S.incomeRow}>
            <label style={S.incomeLabel}>Income ({cur})</label>
            <span style={{ position: "relative", display: "inline-block", width: 150 }}>
              <input className="amt-field green" style={{ ...S.incomeInput, width: "100%" }} inputMode="numeric"
                     placeholder={isMYR ? "e.g. 120" : "e.g. 500.000"} value={incomeDraft}
                     onChange={(e) => setIncomeDraft(sanitizeAmount(e.target.value, isMYR))}
                     onKeyDown={(e) => {
                       if (e.key !== "Enter") return;
                       if (needsGhost(incomeDraft)) { setIncomeDraft(parseNum(digitsOf(incomeDraft) + "000").toLocaleString("id-ID")); return; }
                       addIncomeEntry(amtToIDR(incomeDraft), "", quickIncomeDay());
                       setIncomeDraft(""); setShowIncomeList(true);
                     }} />
              {needsGhost(incomeDraft) && (
                <span style={{ ...S.ghostOverlay, fontSize: 15 }} aria-hidden="true">
                  <span style={{ visibility: "hidden" }}>{incomeDraft}</span>
                  <span style={{ color: "#6d757d" }}>.000</span>
                </span>
              )}
            </span>
            <button className="ghost-plus" style={S.ghostPlusBtn} title="Add income"
                    onClick={() => { addIncomeEntry(amtToIDR(incomeDraft), "", quickIncomeDay()); setIncomeDraft(""); setShowIncomeList(true); }}>+</button>
            <button className="collapse-btn" style={S.arrowBtn}
                    onClick={() => setShowIncomeList((v) => !v)} title="Income history">
              <span className="ca-loop"><span className="ca-rot" style={{ transform: showIncomeList ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span></span>
            </button>
            <span style={S.limitWrap}>
              <button className="limit-label" style={S.incomeLabel}
                      title={`Triple-click to use this limit for every month of ${year}`}
                      onClick={(e) => { if (e.detail === 3) applyLimitToYear(); }}>Daily limit:</button>
              {limitFlash > 0 && (
                <span key={limitFlash} className="limit-flash" onAnimationEnd={() => setLimitFlash(0)}>Applied to all of {year}</span>
              )}
              <input className="limit-input" style={S.limitInput} inputMode="numeric"
                     value={isMYR ? (dailyLimit / MYR_RATE).toFixed(2) : toDisp(dailyLimit).toLocaleString("id-ID")}
                     onChange={(e) => saveLimit(sanitizeAmount(e.target.value, isMYR))} />
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateRows: showIncomeList ? "1fr" : "0fr", transition: "grid-template-rows .28s cubic-bezier(0.4, 0, 0.2, 1)" }}>
            <div style={{ overflow: "hidden", minHeight: 0 }}>
              <div className="glass-soft" style={{ ...S.incomeList, opacity: showIncomeList ? 1 : 0, transform: showIncomeList ? "translateY(0)" : "translateY(-10px)", transition: "opacity .25s ease, transform .25s ease" }}>
                {monthIncomes.length === 0 ? (
                  <span style={S.emptyList}>No income recorded this month.</span>
                ) : sortedIncomes.map((it) => (
                  <span key={it.id} className="chip-flip" ref={(el) => { chipRefs.current[it.id] = el; }} style={S.incomeChip}>
                    +{chipAmt(it.amount)}{cur}
                    {it.day ? <span style={S.chipDay}>({it.day})</span> : null}
                    <button style={S.chipDel} onClick={() => deleteIncomeNow(it.id)} aria-label="Delete">×</button>
                  </span>
                ))}
                {monthIncomes.length > 0 && <span style={S.incomeTotal}>Total {chipAmt(totalIncome)}{cur}</span>}
              </div>
            </div>
          </div>

          <div style={{ ...S.bigPnl, color: stats.pnl >= 0 ? "#3ddc97" : "#ff5d6c" }}>
            <CountNum value={stats.pnl} duration={660}
                      render={(n, b, sp) => `${n >= 0 ? "+" : ""}${fmtLive(n, b, sp)}`} />
            <span style={S.bigPnlSub}>PnL this month</span>
            {pnlVsPrev && (
              <span key={`vs-${year}-${month}`} style={S.pnlVs}>
                <span style={{ color: pnlVsPrev.pct >= 0 ? "#3ddc97" : "#ff5d6c", fontWeight: 700 }}>
                  {pnlVsPrev.pct >= 0 ? "+" : "−"}{Math.abs(pnlVsPrev.pct).toFixed(1).replace(".", ",")}%
                </span>
                {" "}vs {pnlVsPrev.name}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <SplitBar remainingVal={remaining} totalVal={totalIncome} frac={remainFrac} animKey={`m${year}-${month}-${currency}`} />
            </div>
            <ChartButton title="Monthly chart" />
          </div>
          <div style={S.barMeta}>
            <span style={{ color: remainColor(remaining) }}>
              <strong><CountNum value={remaining} duration={560} render={fmtLive} /></strong>
              {" / "}{fmt(totalIncome)}
            </span>
            <span style={{ color: "#ff5d6c" }}>
              <CountNum value={stats.spent} duration={560} render={fmtLive} />
              {" ("}<CountNum value={totalIncome > 0 ? (stats.spent / totalIncome) * 100 : 0} duration={560} render={(n) => Math.round(n)} />{"%)"}
            </span>
          </div>
          <div style={S.dayStats}>
            <span style={{ color: "#3ddc97" }}>
              <CountNum value={stats.greenDays} duration={560} render={(n) => Math.round(n)} />
              {" / +"}<CountNum value={stats.greenSum} duration={560} render={fmtLive} />
            </span>
            <span style={{ color: "#ff5d6c" }}>
              <CountNum value={stats.redDays} duration={560} render={(n) => Math.round(n)} />
              {" / "}<CountNum value={stats.redSum} duration={560} render={fmtLive} />
            </span>
          </div>

          <div className="cal-wrap">
          <div key={`grid-${year}-${month}`} style={S.grid}>
            {DOW.map((d, i) => <div key={i} style={S.dowCell}>{d}</div>)}
            {cells.map((d, i) => {
              if (d === null) return <div key={"e" + i} />;
              const items = spending[keyOf(year, month, d)];
              const has = items && items.length > 0;
              const spent = has ? items.reduce((s, it) => s + it.amount, 0) : 0;
              const dIncomes = monthIncomes.filter((it) => it.day === d);
              const incTotal = dIncomes.reduce((s, it) => s + it.amount, 0);
              const color = spendColor(spent, dailyLimit);
              const bg = !has ? "#26292c" : spendTint(spent, dailyLimit);
              const border = selected === d ? "#ffffff" : d === todayNum ? "#7fb6e0" : has ? spendBorder(spent, dailyLimit) : "#33373b";
              const dayPnl = dailyLimit - spent;
              const dots = [...dIncomes.map(() => "g"), ...(has ? items.map((it) => (it.zero ? "z" : "r")) : [])];
              const dayKey = keyOf(year, month, d);
              return (
                <div key={d} className={`cell${i < 7 ? " tip-below" : ""}`}
                     style={{ ...S.cell, background: bg, borderColor: border, animation: `tileIn .4s var(--ease) ${d * 12}ms backwards` }}
                     onClick={() => { setSelected(d); setNewAmt(""); setNewDesc(""); setNewIncAmt(""); setNewIncDesc(""); }}>
                  <span className="cell-tip glass" style={S.cellTip}>
                    <span style={S.cellTipDate}>{d} {monthLabelFull}</span>
                    <span style={S.cellTipRow}>
                      <span style={{ color: "#3ddc97" }}>+ {fmt(incTotal)}</span>
                      <span style={{ color: "#ff5d6c" }}>− {fmt(spent)}</span>
                    </span>
                    {has && items.some((it) => it.zero) && <span style={{ color: "#a5efcd", fontSize: 11 }}>No spend day</span>}
                  </span>
                  <span style={S.cellDay}>{d}</span>
                  {(dots.length > 0 || (dotGhosts[dayKey] || []).length > 0) && (
                    <span style={{ ...S.dotGrid, gridTemplateColumns: `repeat(${Math.min(dots.length + (dotGhosts[dayKey] || []).length, DOTS_PER_ROW)}, 4px)` }}>
                      {dots.map((t, k) => (
                        <span key={`${t}-${k}`} className="dot-in" style={{ ...S.dot, background: t === "g" ? "#3ddc97" : t === "z" ? "#8a9299" : "#ff5d6c" }} />
                      ))}
                      {(dotGhosts[dayKey] || []).map((t, k) => (
                        <span key={`gh-${k}`} className="dot-out" style={{ ...S.dot, background: t === "g" ? "#3ddc97" : t === "z" ? "#6d757d" : "#ff5d6c" }} />
                      ))}
                    </span>
                  )}
                  {has && spent === 0 && items.some((it) => it.zero) ? (
                    <>
                      <span className="nospend-tag">No spend</span>
                      <span style={{ ...S.cellPnlSmall, color: "#a5efcd" }}>(+{fmt(dailyLimit)})</span>
                    </>
                  ) : has ? (
                    <>
                      <span style={{ ...S.cellSpent, color }}>{fmt(spent)}<span style={S.cellLimit}>/{fmt(dailyLimit)}</span></span>
                      <span style={{ ...S.cellPnlSmall, color: dayPnl >= 0 ? "#a5efcd" : "#ffb3bb" }}>
                        ({dayPnl >= 0 ? "+" : "-"}{fmt(Math.abs(dayPnl))})
                      </span>
                    </>
                  ) : <span style={S.cellEmpty}>·</span>}
                </div>
              );
            })}
          </div>
          </div>

          <div style={{ display: "grid",
                        gridTemplateRows: selected !== null && !panelClosing ? "1fr" : "0fr",
                        transition: "grid-template-rows .32s cubic-bezier(0.4,0,0.2,1)" }}>
           <div style={{ overflow: panelAnim ? "hidden" : "visible", minHeight: 0 }}>
          {selected !== null && (
            <div key={`panel-${selKey}`} className="glass" style={{ ...S.panel, opacity: panelClosing ? 0 : 1, transition: "opacity .24s ease" }}>
              <div style={S.panelHead}>
                <span style={S.panelTitle}>{selected} {monthLabelFull}</span>
                <span style={S.panelTotal}>
                  Total {fmt(dayTotal(selected))} / {fmt(dailyLimit)} · PnL{" "}
                  <strong style={{ color: dailyLimit - dayTotal(selected) >= 0 ? "#3ddc97" : "#ff5d6c" }}>
                    {dailyLimit - dayTotal(selected) >= 0 ? "+" : ""}{fmt(dailyLimit - dayTotal(selected))}
                  </strong>
                </span>
                <button style={S.closeBtn} onClick={closePanel}>✕</button>
              </div>

              <div style={{ ...S.sectionLabel, animation: "fadeDown .25s ease .04s both" }}>Income</div>
              <div style={{ ...S.addRow, animation: "fadeDown .25s ease .07s both" }}>
                <AmountField value={newIncAmt} setValue={setNewIncAmt} accent="green" cur={cur} ghost={needsGhost(newIncAmt)} allowDecimal={isMYR}
                             onSubmit={() => { addIncomeEntry(amtToIDR(newIncAmt), newIncDesc.trim(), selected); setNewIncAmt(""); setNewIncDesc(""); }} />
                <input className="desc-field" style={{ ...S.darkInput, flex: 1, minWidth: 160 }} placeholder="Description — e.g. salary, bonus"
                       value={newIncDesc} onChange={(e) => setNewIncDesc(e.target.value)}
                       onKeyDown={(e) => { if (e.key === "Enter") { addIncomeEntry(amtToIDR(newIncAmt), newIncDesc.trim(), selected); setNewIncAmt(""); setNewIncDesc(""); } }} />
                <button className="draw-btn" style={S.addIconBtn} title="Add income"
                        onClick={() => { addIncomeEntry(amtToIDR(newIncAmt), newIncDesc.trim(), selected); setNewIncAmt(""); setNewIncDesc(""); }}>
                  <PlusIcon />
                </button>
              </div>
              {selIncomes.length > 0 && (
                <div style={{ ...S.expList, marginBottom: 14 }}>
                  {selIncomes.map((it, idx) => (
                    <div key={it.id} className={`row-wrap${removing[it.id] ? " collapsing" : ""}`}>
                      <div style={{ overflow: "hidden", minHeight: 0 }}>
                        <div style={{ display: "flex",
                          animation: removing[it.id] ? "popOutCenter .24s ease both" : `fadeDown .25s ease ${90 + idx * 45}ms backwards`,
                          transformOrigin: "center center" }}>
                          <div className="entry-row glass-soft inc" style={S.entryRow}>
                            <input style={{ ...S.entryAmt, color: "#3ddc97" }} inputMode="numeric" value={dispStr(it.amount)}
                                   onChange={(e) => editIncome(it.id, "amount", e.target.value)} onBlur={commitEdits}
                                   onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
                            <span style={S.entryDivider} />
                            <input style={S.entryDesc} value={it.desc} placeholder=""
                                   onChange={(e) => editIncome(it.id, "desc", e.target.value)} onBlur={commitEdits}
                                   onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
                            <button className="trash-btn" style={S.delBtn} onClick={() => deleteIncome(it.id)} title="Delete"><TrashIcon /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ ...S.sectionLabel, animation: "fadeDown .25s ease .1s both" }}>Expenses</div>
              <div style={{ ...S.addRow, animation: "fadeDown .25s ease .13s both" }}>
                <AmountField value={newAmt} setValue={setNewAmt} accent="red" cur={cur} ghost={needsGhost(newAmt)} allowDecimal={isMYR} onSubmit={addExpense} />
                <input className="desc-field" style={{ ...S.darkInput, flex: 1, minWidth: 160 }} placeholder="Description — e.g. lunch, fuel, coffee"
                       value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                       onKeyDown={(e) => e.key === "Enter" && addExpense()} />
                <button className="draw-btn" style={S.addIconBtnRed}
                        title="Add expense · double-click for a no-spend day"
                        onClick={addExpense} onDoubleClick={addZeroDay}><MinusIcon /></button>
              </div>

              {selItems.length === 0 ? (
                <p style={S.emptyList}>No expenses recorded for this day.</p>
              ) : (
                <div style={S.expList}>
                  {selItems.map((it, idx) => (
                    <div key={it.id} className={`row-wrap${removing[it.id] ? " collapsing" : ""}`}>
                      <div style={{ overflow: removing[it.id] ? "hidden" : "visible", minHeight: 0 }}>
                        <div style={{ display: "flex",
                          animation: removing[it.id] ? "popOutCenter .24s ease both" : `fadeDown .25s ease ${160 + idx * 45}ms backwards`,
                          transformOrigin: "center center" }}>
                          {it.zero ? (
                          <div className="entry-row glass-soft nospend-row" style={S.entryRow}>
                            <span className="msym" style={{ fontSize: 19, color: "#8fd7a4", marginLeft: 4 }}>do_not_disturb_on</span>
                            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#c9f2dd" }}>No spend day</span>
                            <span style={{ fontSize: 12, color: "#8fd7a4", marginRight: 6 }}>+{fmt(dailyLimit)} kept</span>
                            <button className="trash-btn" style={S.delBtn} onClick={() => deleteExpense(it.id)} title="Remove no-spend mark"><TrashIcon /></button>
                          </div>
                          ) : (
                          <div className="entry-row glass-soft exp" style={S.entryRow}>
                            <input style={{ ...S.entryAmt, color: "#ff5d6c" }} inputMode="numeric" value={dispStr(it.amount)}
                                   onChange={(e) => editExpense(it.id, "amount", e.target.value)} onBlur={commitEdits}
                                   onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
                            <span style={S.entryDivider} />
                            <input style={S.entryDesc} value={it.desc} placeholder=""
                                   onChange={(e) => editExpense(it.id, "desc", e.target.value)} onBlur={commitEdits}
                                   onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
                            <span style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                              <button className="ham-btn" style={S.catBtn} title="Category"
                                      onClick={() => setCatMenu(catMenu && catMenu.id === it.id ? null : { id: it.id, stage: "cats", closing: false })}>
                                <CatReel cat={it.cat || inferCat(it.desc) || aiCats[it.id] || null} customIcon={it.icon || null} />
                              </button>

                              {catMenu && catMenu.id === it.id && catMenu.stage === "cats" && (
                                <div className={`cat-pop glass${catMenu.closing ? " closing" : ""}`} style={S.catPop}>
                                  {CAT_ORDER.map((c) => (
                                    <button key={c} className="cat-opt" style={S.catOpt} title={CATS[c].label}
                                            onClick={() => {
                                              if (c === "other") { setOtherDesc(it.desc || ""); setCatMenu({ id: it.id, stage: "other", closing: false }); return; }
                                              setItemCat(it.id, c, null); closeCatMenu();
                                            }}>
                                      <span className="msym" style={{ fontSize: 19 }}>{CATS[c].icon}</span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {catMenu && catMenu.id === it.id && catMenu.stage === "other" && (
                                <div className={`cat-pop glass${catMenu.closing ? " closing" : ""}`} style={S.otherPop}>
                                  <input style={S.otherInput} placeholder="Description" value={otherDesc} autoFocus
                                         onChange={(e) => setOtherDesc(e.target.value)}
                                         onKeyDown={(e) => { if (e.key === "Enter") { setItemDescAndCat(it.id, otherDesc, "other"); closeCatMenu(); } }} />
                                  <button className="icon-opt" style={S.globeBtn} title="Choose an icon"
                                          onClick={() => setCatMenu({ id: it.id, stage: "icons", closing: false })}>
                                    <span className="msym" style={{ fontSize: 19, color: "#e3b341" }}>language</span>
                                  </button>
                                </div>
                              )}

                              {catMenu && catMenu.id === it.id && catMenu.stage === "icons" && (
                                <div className={`cat-pop glass${catMenu.closing ? " closing" : ""}`} style={S.iconPop}>
                                  {ICON_CHOICES.map((ic) => (
                                    <button key={ic} className="icon-opt" style={S.iconOpt}
                                            onClick={() => { setItemDescAndCat(it.id, otherDesc, "other", ic); closeCatMenu(); }}>
                                      <span className="msym" style={{ fontSize: 19 }}>{ic}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </span>
                            <button className="trash-btn" style={S.delBtn} onClick={() => deleteExpense(it.id)} title="Delete"><TrashIcon /></button>
                          </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
           </div>
          </div>

          <div ref={weekCardRef} className={`flow-card glass${weekSeen ? " shown" : ""}`} style={{ ...S.flowCard, marginTop: 24 }}>
            <div style={S.flowHead}>
              <span style={S.sectionLabel}>Weekly expenses</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={S.flowSub}>
                  <CountNum value={weekData.total} duration={560} render={fmtLive} /> · {weekData.range}
                </span>
                <button className={`plain-arrow chev${weekOpen ? " up" : ""}`} style={S.plainArrow}
                        onClick={() => {
                          if (weekOpen) {
                            setWeekClosing(true);
                            setTimeout(() => { setWeekOpen(false); setWeekClosing(false); }, 300);
                          } else { setWeekOpen(true); setWeekRun((n) => n + 1); }
                        }}
                        title={weekOpen ? "Hide weekly expenses" : "Show weekly expenses"}><Chevron /></button>
              </span>
            </div>
            <div style={{ display: "grid",
                          gridTemplateRows: weekOpen && !weekClosing ? "1fr" : "0fr",
                          transition: "grid-template-rows .34s cubic-bezier(0.4,0,0.2,1)" }}>
              <div style={{ overflow: "hidden", minHeight: 0 }}>
                <div key={`weekrun-${weekRun}-${weekSeen}-${weekData.range}`}
                     style={{ opacity: weekClosing ? 0 : 1, transform: weekClosing ? "translateY(-14px)" : "translateY(0)",
                              transition: "opacity .26s ease, transform .3s cubic-bezier(0.4,0,0.2,1)" }}>
                  {renderWeek()}
                </div>
              </div>
            </div>
          </div>

          <div ref={goalsCardRef} className={`flow-card glass${goalsSeen ? " shown" : ""}`}
               style={{ ...S.flowCard, position: "relative", zIndex: goalIconMenu ? 6 : "auto" }}>
            <div style={S.flowHead}>
              <span style={S.sectionLabel}>Goals</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {goals.length > 0 && (
                  <span style={S.flowSub}>
                    <CountNum value={goals.reduce((a, g) => a + goalSaved(g), 0)} duration={600} render={fmtLive} />
                    {" of "}{fmt(goals.reduce((a, g) => a + g.target, 0))}
                  </span>
                )}
                <button className={`plain-arrow chev${goalsOpen ? " up" : ""}`} style={S.plainArrow}
                        onClick={() => {
                          if (goalsOpen) {
                            setGoalsClosing(true);
                            setTimeout(() => { setGoalsOpen(false); setGoalsClosing(false); }, 300);
                          } else { setGoalsOpen(true); setGoalsRun((n) => n + 1); }
                        }}
                        title={goalsOpen ? "Hide goals" : "Show goals"}><Chevron /></button>
              </span>
            </div>
            <div style={{ display: "grid",
                          gridTemplateRows: goalsOpen && !goalsClosing ? "1fr" : "0fr",
                          transition: "grid-template-rows .34s cubic-bezier(0.4,0,0.2,1)" }}>
              <div style={{ overflow: goalIconMenu ? "visible" : "hidden", minHeight: 0 }}>
                <div key={`goalsrun-${goalsRun}-${goalsSeen}`}
                     style={{ opacity: goalsClosing ? 0 : 1, transform: goalsClosing ? "translateY(-14px)" : "translateY(0)",
                              transition: "opacity .26s ease, transform .3s cubic-bezier(0.4,0,0.2,1)" }}>
                  {renderGoals()}
                </div>
              </div>
            </div>
          </div>

          <div ref={flowCardRef} className={`flow-card glass${flowSeen ? " shown" : ""}`} style={S.flowCard}>
            <div style={S.flowHead}>
              <span style={S.sectionLabel}>Money flow</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={S.flowSub}>{monthLabel}</span>
                <button className={`plain-arrow chev${flowOpen ? " up" : ""}`} style={S.plainArrow}
                        onClick={() => {
                          if (flowOpen) {
                            setFlowClosing(true);
                            setTimeout(() => { setFlowOpen(false); setFlowClosing(false); }, 300);
                          } else { setFlowOpen(true); setFlowRun((n) => n + 1); }
                        }}
                        title={flowOpen ? "Hide money flow" : "Show money flow"}><Chevron /></button>
              </span>
            </div>
            <div style={{ display: "grid",
                          gridTemplateRows: flowOpen && !flowClosing ? "1fr" : "0fr",
                          transition: "grid-template-rows .34s cubic-bezier(0.4,0,0.2,1)" }}>
              <div style={{ overflow: "hidden", minHeight: 0 }}>
                <div key={`flowrun-${flowRun}-${year}-${month}`}
                     style={{ opacity: flowClosing ? 0 : 1, transform: flowClosing ? "translateY(-14px)" : "translateY(0)",
                              transition: "opacity .26s ease, transform .3s cubic-bezier(0.4,0,0.2,1)" }}>
                  {renderFlow()}
                  {renderScore()}
                  {renderInsights()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {launched && recap && renderRecap()}
      {launched && cfgDraft && renderTestCfg()}

      {launched && catView && (
        <div style={{ ...S.backdrop, animation: catViewClosing ? "fadeOut .19s ease both" : "fadeIn .2s ease backwards" }} onClick={closeCatView}>
          <div className="glass" style={{ ...S.modal, width: "min(620px, 94vw)", animation: catViewClosing ? "modalPopOut .24s var(--ease-soft) both" : "modalPop .4s var(--ease) backwards" }}
               onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <span key={`ttl-${catView}`} className="bd-title" style={{ ...S.panelTitle, display: "inline-flex", alignItems: "center", gap: 9 }}>
                {catView === "income"
                  ? <span style={S.bdIconWin}><span className="msym" style={{ fontSize: 20, color: CAT_COLORS.income }}>money</span></span>
                  : <CatTitleReel cat={catView} />}
                {catView === "income" ? "Income Sources" : catView === "bills" ? "Bills" : `${CATS[catView].label} Expenses`}
                <span key={`vs-${catView}`} style={S.bdVs}>
                  VS LAST MONTH{" "}
                  <span style={{ color: "#747c84" }}>
                    {catBreakdown.vsPct === null ? "N/A" : `${catBreakdown.vsPct >= 0 ? "+" : "−"}${Math.abs(Math.round(catBreakdown.vsPct))}%`}
                  </span>
                </span>
              </span>
              <button style={S.closeBtn} onClick={closeCatView}>✕</button>
            </div>
            <div style={S.modeRow}>
              {["income", ...CAT_ORDER].map((c) => {
                const active = catView === c;
                const hot = hoverBtn === c && suppressBtn !== c;
                const col = CAT_COLORS[c];
                return (
                  <button key={c} title={c === "income" ? "Income sources" : CATS[c].label}
                          onMouseEnter={() => { if (suppressBtn !== c) setHoverBtn(c); }}
                          onMouseLeave={() => { setHoverBtn(null); if (suppressBtn === c) setSuppressBtn(null); }}
                          onClick={() => { setCatView(c); setHoverBtn(null); setSuppressBtn(c); }}
                          style={{ ...S.modeBtn, minWidth: 38,
                            color: active ? col : hot ? "#e8eaec" : "#6d757d",
                            borderColor: active ? col : hot ? "#8a9299" : "#33373b",
                            background: active ? "#1e2124" : "none",
                            display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <span className={`cat-swap${hot ? " on" : ""}`}>
                      <span className="msym glyph g-base" style={{ fontSize: 17 }}>{c === "income" ? "savings" : CATS[c].icon}</span>
                      <span className="msym glyph g-hover" style={{ fontSize: 17 }}>{CAT_HOVER_ICON[c]}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", transition: "height .34s cubic-bezier(0.4,0,0.2,1)", height: bdHeight, overflow: "hidden" }}>
              <div ref={bdRef} style={{ alignSelf: "start" }}>
                {catBreakdown.rows.length === 0 ? (
                  <div key={`empty-${catView}`} className="bd-item" style={S.flowEmpty}>{catView === "income" ? "No income recorded this month." : "Nothing recorded in this category this month."}</div>
                ) : (
                  <div key={`bd-${catView}`} style={S.bdList}>
                    {catBreakdown.rows.map((r, i) => {
                      const pct = Math.max(1, Math.round((r.amount / catBreakdown.total) * 100));
                      return (
                        <div key={r.label} className="bd-item" style={{ ...S.bdRow, animationDelay: `${60 + i * 55}ms` }}>
                          <span style={S.bdName}>{r.label}</span>
                          <span style={{ ...S.bdPct, color: CAT_COLORS[catView] }}>{pct}%</span>
                          <span style={S.bdTrack}>
                            <span className="bd-fill" style={{ width: `${pct}%`, background: CAT_COLORS[catView], animationDelay: `${100 + i * 55}ms` }} />
                          </span>
                          <span style={S.bdAmt}>{fmt(r.amount)}</span>
                        </div>
                      );
                    })}
                    <div className="bd-item" style={{ ...S.bdTotal, animationDelay: `${60 + catBreakdown.rows.length * 55}ms` }}>
                      Total {fmt(catBreakdown.total)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {launched && chartOpen && (
        <div style={{ ...S.backdrop, animation: chartClosing ? "fadeOut .19s ease both" : "fadeIn .2s ease backwards" }} onClick={() => closeChart()}>
          <div className="glass" style={{ ...S.modal, animation: chartClosing ? "modalPopOut .24s var(--ease-soft) both" : "modalPop .4s var(--ease) backwards" }} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <span style={S.panelTitle}>Chart — {view === "year" ? year : monthLabel}</span>
              <button style={S.closeBtn} onClick={() => closeChart()}>✕</button>
            </div>
            <div style={S.modeRow}>
              {[
                { id: "income", label: "+", title: "Income only", on: "#3ddc97", onB: "#1e4436" },
                { id: "expense", label: "−", title: "Expenses only", on: "#ff5d6c", onB: "#5a2830" },
                { id: "both", label: "pnl", title: "Cumulative PnL", on: "#e8eaec", onB: "#8a9299" },
              ].map((m) => (
                <button key={m.id} className="mode-btn" title={m.title} onClick={() => { setHoverPt(null); setChartMode(m.id); }}
                        style={{ ...S.modeBtn, color: chartMode === m.id ? m.on : "#6d757d",
                          borderColor: chartMode === m.id ? m.onB : "#33373b",
                          background: chartMode === m.id ? "rgba(255,255,255,0.07)" : "none" }}>
                  {m.label === "pnl"
                    ? (<span style={{ display: "inline-flex", gap: 1 }}>
                         <span style={{ color: chartMode === m.id ? "#3ddc97" : "inherit" }}>+</span>
                         <span style={{ opacity: 0.75 }}>/</span>
                         <span style={{ color: chartMode === m.id ? "#ff5d6c" : "inherit" }}>−</span>
                       </span>)
                    : m.label}
                </button>
              ))}
            </div>
            {renderChart(view === "year" ? "year" : "month")}
            <div key={`legend-${chartMode}`} style={S.legend}>
              {chartMode === "expense" && <span style={{ color: "#ff5d6c", animation: "fadeRight .3s ease both" }}>— Expenses</span>}
              {chartMode === "income" && <span style={{ color: "#3ddc97", animation: "fadeRight .3s ease both" }}>▮ Income</span>}
              {chartMode === "both" && <span style={{ color: "#3ddc97", animation: "fadeRight .3s ease both" }}>▬ Cumulative PnL (carried over)</span>}
            </div>
          </div>
        </div>
      )}

      {launched && <div style={S.footerRow}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <button className="foot-logo" onClick={goHome} title="Back to home" aria-label="Back to home"><CrocLogo /></button>
          <span>{!loaded ? "Loading…" : saving ? "Saving…" : ""}</span>
         {saveError && <span className="bk-msg" style={{ color: "#ff8d97" }} title="Your browser refused to store the data (storage full or blocked). Export a backup now.">Couldn't save — export a backup</span>}
          <button className="bk-btn" onClick={exportData} title="Download a JSON backup of everything">Export</button>
          <button className="bk-btn" onClick={() => fileRef.current?.click()} title="Restore from a backup file">Import</button>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
                 onChange={(e) => { importData(e.target.files?.[0]); e.target.value = ""; }} />
          {backupMsg && <span className="bk-msg">{backupMsg}</span>}
          {undoImport && <button className="bk-btn" onClick={revertImport} title="Put back the data you had before this import">Undo</button>}
          {SHOW_TEST_TOOLS && <>
          <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)", margin: "0 2px" }} />
          <button className="bk-btn test" onClick={onTestDataClick} title="Click: add test data with your saved settings · Double-click: change the settings">Add test data</button>
          <button className="bk-btn" onClick={clearTestData} title="Remove only the generated test entries">Clear test data</button>
          {testMsg && <span className="bk-msg" style={{ color: "#e3cd77" }}>{testMsg}</span>}
          </>}
        </span>

      </div>}
    </div>
  );
}

const S = {
  page: { background: "transparent", minHeight: "100vh", color: "#e8eaec", width: "100%", maxWidth: 1280, margin: "0 auto", padding: "30px 32px 52px" },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" },
  title: { margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-0.015em" },
  navBox: { display: "flex", alignItems: "center", gap: 8 },
  monthLabelBtn: { fontSize: 16, fontWeight: 600, minWidth: 90, textAlign: "center", background: "none", border: "none", color: "#e8eaec", cursor: "pointer", padding: "4px 6px", transition: "color .15s" },
  currency: { fontSize: 13, color: "#9aa3ab", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "5px 12px", marginLeft: 4, cursor: "pointer", transition: "border-color .18s, color .18s" },
  curMenu: { position: "absolute", top: "calc(100% + 8px)", right: 0, borderRadius: 12, padding: 3, display: "flex", flexDirection: "column", gap: 2, zIndex: 40, minWidth: 78, boxShadow: "0 10px 24px rgba(0,0,0,0.45)", animation: "fadeDown .18s ease both" },
  curOpt: { border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", textAlign: "left", transition: "background .18s ease, color .18s ease", letterSpacing: "0.02em" },

  yearHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 28, marginBottom: 24, flexWrap: "wrap" },
  yearBigWrap: { display: "flex", alignItems: "center", gap: 8 },
  yearBig: { fontSize: 66, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.02em", display: "inline-flex", alignItems: "flex-start" },
  yearBarWrap: { flex: 1, minWidth: 260, paddingTop: 14 },
  chartBtn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#9aa3ab", borderRadius: 10, width: 34, height: 30, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  yearGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  yearCell: { borderWidth: 1, borderStyle: "solid", borderRadius: 16, minHeight: 116, padding: 12, cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, transition: "border-color .15s", fontVariantNumeric: "tabular-nums" },
  yearCellName: { position: "absolute", top: 8, left: 10, fontSize: 12, fontWeight: 600, color: "#8a9299" },
  yearCellSpent: { fontSize: 18, fontWeight: 700 },
  yearCellExp: { fontSize: 11, fontWeight: 400, color: "#8a9299" },

  incomeRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  incomeLabel: { fontSize: 13, color: "#9aa3ab" },
  incomeInput: { background: "rgba(44,48,53,0.55)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 11, color: "#e8eaec", padding: "9px 13px", fontSize: 15 },
  ghostOverlay: { position: "absolute", left: 0, top: 0, height: "100%", display: "flex", alignItems: "center", padding: "0 12px", fontSize: 14, pointerEvents: "none", fontVariantNumeric: "tabular-nums", whiteSpace: "pre" },
  ghostPlusBtn: { borderRadius: 11, width: 36, height: 38, fontSize: 20, fontWeight: 600, cursor: "pointer", lineHeight: 1 },
  arrowBtn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#9aa3ab", borderRadius: 11, width: 36, height: 38, fontSize: 14, cursor: "pointer" },
  limitWrap: { display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", position: "relative" },
  limitInput: { color: "#e8eaec", padding: "8px 10px", fontSize: 14, width: 100, borderRadius: 6 },
  incomeList: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderRadius: 12, padding: "11px 13px", marginBottom: 14 },
  incomeChip: { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(61,220,151,0.12)", border: "1px solid rgba(61,220,151,0.28)", color: "#5ee3a9", borderRadius: 999, padding: "5px 12px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  chipDay: { fontSize: 11, color: "#8a9299", fontWeight: 500 },
  chipDel: { background: "none", border: "none", color: "#6d757d", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 },
  incomeTotal: { marginLeft: "auto", fontSize: 13, color: "#9aa3ab", fontVariantNumeric: "tabular-nums" },

  bigPnl: { fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "baseline", gap: 12 },
  bigPnlSub: { fontSize: 13, fontWeight: 500, color: "#9aa3ab" },
  pnlVs: { marginLeft: "auto", fontSize: 13, fontWeight: 500, color: "#9aa3ab", letterSpacing: 0, animation: "fadeRight .4s ease both" },
  bdVs: { marginLeft: 6, fontSize: 10.5, fontWeight: 600, color: "#50575e", letterSpacing: "0.1em", alignSelf: "center", animation: "fadeRight .35s ease .1s both" },
  wrKicker: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 700, color: "#9aa3ab", textTransform: "uppercase", letterSpacing: "0.16em" },
  wrLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "#8a9299", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 },
  wrHeroNum: { fontSize: 54, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontVariantNumeric: "tabular-nums" },
  wrHeroSub: { fontSize: 13, color: "#9aa3ab", marginTop: 8, lineHeight: 1.5 },
  wrBig: { fontSize: 25, fontWeight: 800, letterSpacing: "-0.02em", color: "#e8eaec", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" },
  wrValue: { fontSize: 17, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums" },
  wrSmall: { fontSize: 12, color: "#8a9299", marginTop: 4, lineHeight: 1.4 },
  wrLegend: { display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 11.5, color: "#8a9299", marginTop: 9 },
  barTrack: { height: 11, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden", display: "flex", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" },
  barSeg: { height: "100%" },
  barMeta: { display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4, fontVariantNumeric: "tabular-nums", marginTop: 8 },
  dayStats: { display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 20, fontVariantNumeric: "tabular-nums" },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 },
  dowCell: { textAlign: "center", fontSize: 11, color: "#7d858d", padding: "6px 0 10px", fontWeight: 700, letterSpacing: "0.12em" },
  cell: { borderWidth: 1, borderStyle: "solid", borderRadius: 14, minHeight: 88, padding: 8, cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, transition: "border-color .15s", fontVariantNumeric: "tabular-nums", transformOrigin: "center center" },
  cellDay: { position: "absolute", top: 6, left: 9, fontSize: 12, color: "#8a9299" },
  dotGrid: { position: "absolute", bottom: 7, left: 10, display: "grid", gap: 3, justifyItems: "start" },
  dot: { width: 4, height: 4, borderRadius: 99 },
  cellTip: { borderRadius: 11, padding: "8px 13px", display: "flex", flexDirection: "column", gap: 3, fontSize: 12, boxShadow: "0 6px 18px rgba(0,0,0,0.35)" },
  cellTipDate: { color: "#8b949d", fontWeight: 700, textAlign: "center", fontSize: 11, letterSpacing: "0.04em" },
  cellTipRow: { display: "flex", gap: 14, justifyContent: "center", fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums" },
  cellSpent: { fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 },
  cellLimit: { fontSize: 8, fontWeight: 600, color: "#8a9299" },
  cellPnlSmall: { fontSize: 10, fontWeight: 600 },
  cellEmpty: { color: "#4a5055" },

  panel: { marginTop: 24, borderRadius: 16, padding: "18px 20px" },
  panelHead: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14, animation: "fadeDown .25s ease both" },
  panelTitle: { fontSize: 15, fontWeight: 700 },
  panelTotal: { fontSize: 13, color: "#9aa3ab", marginLeft: "auto", fontVariantNumeric: "tabular-nums" },
  sectionLabel: { fontSize: 11.5, fontWeight: 700, color: "#9aa3ab", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 9 },
  closeBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#9aa3ab", borderRadius: 10, width: 30, height: 30, cursor: "pointer", fontSize: 12 },
  addRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" },
  darkInput: { background: "rgba(24,27,31,0.62)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 11, color: "#e8eaec", padding: "10px 13px", fontSize: 14 },
  addIconBtn: { background: "linear-gradient(160deg,#54e6a8,#2bbd80)", color: "#07291c", border: "none", borderRadius: 11, width: 40, height: 38, boxShadow: "0 6px 18px rgba(61,220,151,0.28), inset 0 1px 0 rgba(255,255,255,0.35)", fontSize: 20, fontWeight: 700, cursor: "pointer", lineHeight: 1 },
  addIconBtnRed: { background: "linear-gradient(160deg,#ff7a86,#e0434f)", color: "#2b0d11", border: "none", borderRadius: 11, width: 40, height: 38, boxShadow: "0 6px 18px rgba(255,93,108,0.26), inset 0 1px 0 rgba(255,255,255,0.32)", fontSize: 20, fontWeight: 700, cursor: "pointer", lineHeight: 1 },
  emptyList: { color: "#6d757d", fontSize: 13, margin: "6px 2px" },
  expList: { display: "flex", flexDirection: "column", gap: 8 },
  entryRow: { width: "100%", display: "flex", alignItems: "center", borderRadius: 11, padding: "5px 7px", minWidth: 0, overflow: "visible" },
  entryAmt: { width: 150, padding: "8px 10px", fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  entryDivider: { width: 1, height: 20, background: "#3a3f44", flexShrink: 0 },
  entryDesc: { flex: 1, minWidth: 40, padding: "8px 12px", fontSize: 14, color: "#c7cdd2" },
  catBtn: { background: "none", border: "1px solid transparent", color: "#8a9299", borderRadius: 6, width: 32, height: 30, padding: 0, cursor: "pointer", flexShrink: 0, marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  catPop: { position: "absolute", bottom: "calc(100% + 8px)", right: -4, borderRadius: 12, padding: 4, display: "flex", gap: 2, zIndex: 40, boxShadow: "0 10px 24px rgba(0,0,0,0.45)" },
  catOpt: { background: "none", border: "none", borderRadius: 7, width: 34, height: 32, color: "#9aa3ab", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  otherPop: { position: "absolute", bottom: "calc(100% + 8px)", right: -4, borderRadius: 12, padding: 5, display: "flex", gap: 5, alignItems: "center", zIndex: 41, boxShadow: "0 10px 24px rgba(0,0,0,0.45)" },
  otherInput: { background: "#1e2124", border: "1px solid #3a3f44", borderRadius: 7, color: "#e8eaec", padding: "7px 10px", fontSize: 13, width: 168, outline: "none" },
  globeBtn: { background: "none", border: "1px solid #3f454b", borderRadius: 7, width: 32, height: 32, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  iconPop: { position: "absolute", bottom: "calc(100% + 8px)", right: -4, borderRadius: 12, padding: 6, display: "grid", gridTemplateColumns: "repeat(6, 32px)", gap: 2, zIndex: 42, boxShadow: "0 12px 28px rgba(0,0,0,0.5)" },
  iconOpt: { background: "none", border: "none", borderRadius: 7, width: 32, height: 30, color: "#9aa3ab", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  delBtn: { background: "rgba(255,93,108,0.06)", border: "1px solid rgba(255,93,108,0.28)", color: "#ff8d97", borderRadius: 10, width: 34, height: 32, padding: 0, cursor: "pointer", flexShrink: 0, marginLeft: 6 },

  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px) saturate(115%)", WebkitBackdropFilter: "blur(10px) saturate(115%)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 },
  modal: { borderRadius: 20, width: "min(900px, 92vw)", maxHeight: "88vh", overflow: "auto", padding: "20px 22px 18px", transformOrigin: "center center" },
  modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modeRow: { display: "flex", gap: 6, marginBottom: 12 },
  modeBtn: { border: "1px solid", borderRadius: 11, minWidth: 44, height: 32, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "0 11px", transition: "color .22s cubic-bezier(0.32,0.72,0.24,1), border-color .22s, background .22s, transform .22s", fontVariantNumeric: "tabular-nums" },
  legend: { display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, marginTop: 10 },

  flowCard: { marginTop: 24, marginLeft: -14, marginRight: -14, borderRadius: 20, padding: "18px 20px 12px" },
  flowHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 },
  flowSub: { fontSize: 12, color: "#6d757d" },
  plainArrow: { background: "none", border: "none", color: "#6d757d", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "2px 4px" },
  flowEmpty: { color: "#6d757d", fontSize: 13, padding: "18px 2px" },
  insTitle: { fontSize: 11.5, fontWeight: 700, color: "#9aa3ab", textTransform: "uppercase", letterSpacing: "0.14em" },
  insEmpty: { color: "#6d757d", fontSize: 13, padding: "12px 2px 8px" },
  insText: { fontSize: 13.5, color: "#aeb5bb", lineHeight: 1.45 },
  goalTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  goalName: { fontSize: 14.5, fontWeight: 700, color: "#e8eaec" },
  goalNote: { fontSize: 11.5, fontWeight: 500, color: "#6d757d", marginLeft: 8 },
  goalAmt: { fontSize: 13, fontWeight: 600, color: "#e8eaec", fontVariantNumeric: "tabular-nums" },
  goalBarRow: { display: "flex", alignItems: "center", gap: 12, marginTop: 9 },
  goalPct: { fontSize: 13, fontWeight: 700, minWidth: 44, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  goalFundRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 10 },
  // every square button in a fund/new-goal row matches the amount field's height exactly

  bdIconWin: { width: 22, height: 22, overflow: "hidden", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  bdList: { display: "flex", flexDirection: "column", gap: 12, marginTop: 6, paddingBottom: 4 },
  bdRow: { display: "grid", gridTemplateColumns: "minmax(90px, 190px) 46px 1fr auto", alignItems: "center", gap: 12 },
  bdName: { fontSize: 14, fontWeight: 600, color: "#e8eaec", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  bdPct: { fontSize: 14, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  bdTrack: { height: 8, background: "#3a3f44", borderRadius: 99, overflow: "hidden", display: "block" },
  bdAmt: { fontSize: 12, color: "#8a9299", fontVariantNumeric: "tabular-nums", minWidth: 54, textAlign: "right" },
  bdTotal: { marginTop: 6, fontSize: 12, color: "#6d757d", textAlign: "right", fontVariantNumeric: "tabular-nums" },
  scoreCard: { display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", marginTop: 4, paddingTop: 16, borderTop: "1px solid #33373b" },
  scoreCenter: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  scoreNum: { fontSize: 40, fontWeight: 800, color: "#f2f5f8", lineHeight: 1, fontVariantNumeric: "tabular-nums", textShadow: "0 2px 18px rgba(180,210,240,0.16)" },
  scoreCap: { fontSize: 10, fontWeight: 700, color: "#6d757d", letterSpacing: "0.14em", marginTop: 3 },
  scoreWord: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em" },
  scorePill: { fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", padding: "4px 11px", borderRadius: 99 },
  scoreLabel: { fontSize: 11, fontWeight: 700, color: "#6d757d", letterSpacing: "0.12em", marginTop: 4 },
  scoreText: { fontSize: 13.5, color: "#c7cdd2", lineHeight: 1.55, margin: "8px 0 0", maxWidth: 460 },
  subRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, width: "100%", marginTop: 4 },
  subBox: { borderRadius: 14, padding: "13px 15px 15px" },
  subLabel: { fontSize: 10.5, fontWeight: 700, color: "#6d757d", letterSpacing: "0.11em" },
  subNote: { fontSize: 12, fontWeight: 600, color: "#8a9299", fontVariantNumeric: "tabular-nums" },
  subValue: { fontSize: 22, fontWeight: 800, margin: "5px 0 10px", fontVariantNumeric: "tabular-nums" },
  subTrack: { height: 6, background: "#2c3034", borderRadius: 99, overflow: "hidden", display: "block" },
  footerRow: { marginTop: 32, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 12, color: "#6d757d", display: "flex", justifyContent: "space-between" },
};
